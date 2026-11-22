import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';

import type { AuthUser } from '../common/current-user';
import { dealStageOf } from '../deals/deal-stage';
import { fullName, maskedName, todayUtc } from '../rentals/rentals.math';
import { MediaService } from '../media/media.service';
import { ModerationService } from '../moderation/moderation.service';
import { Conversation, type ChatContext, type ConversationDocument } from '../schemas/conversation.schema';
import { Deal } from '../schemas/deal.schema';
import { ChatFile } from '../schemas/chat-file.schema';
import { Message, type MessageDocument } from '../schemas/message.schema';
import { Offer } from '../schemas/offer.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { WantedRequest } from '../schemas/wanted-request.schema';
import { User } from '../schemas/user.schema';
import type { OpenChatDto } from './chat.dto';
import { ChatGateway } from './chat.gateway';
import { type Attachment, AttachmentError, attachmentsLabel, parseAttachments } from './attachments';
import { canEditMessage, cleanMessage, DELETED_PREVIEW, preview } from './chat.math';
import { ChatFileError, checkChatFile } from './chat-files';
import { binaryToBuffer } from '../insurance/insurance.files';

type Side = 'owner' | 'renter';
type Person = { firstName: string; lastName: string; phone?: string; photoUri?: string };
type Source = { kind: 'request' | 'offer'; id: Types.ObjectId };
/** Стан розмови: чи можна писати, чи відкрито повне ім'я й на якому етапі домовленість */
type Info = { stage: string; dealId: string | null; wantedId: string | null; canSend: boolean; full: boolean };

const key = (kind: string | undefined, id: unknown) => `${kind}:${String(id)}`;

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly log = new Logger(ChatService.name);

  constructor(
    @InjectModel(Conversation.name) private readonly conversations: Model<Conversation>,
    @InjectModel(Message.name) private readonly messages: Model<Message>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectModel(WantedRequest.name) private readonly wanted: Model<WantedRequest>,
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(ChatFile.name) private readonly chatFiles: Model<ChatFile>,
    private readonly gateway: ChatGateway,
    private readonly moderation: ModerationService,
    private readonly config: ConfigService,
    private readonly media: MediaService,
  ) {
    gateway.chat = this;
  }

  /**
   * Раніше розмова була одна на пару людей. Тепер — окрема під кожен запит чи пропозицію, тому старий
   * унікальний індекс прибираємо, а існуючі розмови прив'язуємо до їхньої останньої домовленості.
   */
  async onModuleInit() {
    try {
      await this.conversations.collection.dropIndex('ownerId_1_renterId_1');
    } catch {
      // індексу вже немає
    }
    try {
      const legacy = await this.conversations.find({ sourceId: { $exists: false } }).exec();
      for (const c of legacy) await this.adopt(c);
      if (legacy.length) this.log.log(`Перенесено старих розмов: ${legacy.length}`);
    } catch (e) {
      this.log.warn(`Перенесення старих розмов не вдалось: ${String(e)}`);
    }
  }

  private async adopt(c: ConversationDocument) {
    const pair = { ownerId: c.ownerId, renterId: c.renterId };
    const deal = await this.deals.findOne(pair).sort({ createdAt: -1 }).exec();
    let source: Source | null = deal ? { kind: deal.source as Source['kind'], id: deal.sourceId } : null;
    let context: ChatContext | undefined = deal ? { title: deal.title, photoUri: deal.photoUri, city: deal.city, pricePerDay: deal.pricePerDay, startDate: deal.startDate, endDate: deal.endDate } : undefined;
    let carId = deal?.carId;
    if (!source) {
      const r = await this.rentals.findOne({ ...pair, status: { $in: ['pending', 'accepted'] } }).sort({ createdAt: -1 }).exec();
      if (r) {
        source = { kind: 'request', id: r._id };
        context = { title: r.car.title, photoUri: r.car.photoUri, city: r.car.city, pricePerDay: r.car.pricePerDay, startDate: r.startDate, endDate: r.endDate };
        carId = r.carId;
      }
    }
    if (!source) {
      // Немає, до чого прив'язати: розмову не відновити
      await this.dropMessages({ conversationId: c._id });
      await this.conversations.deleteOne({ _id: c._id });
      return;
    }
    const taken = await this.conversations.exists({ sourceKind: source.kind, sourceId: source.id });
    if (taken) {
      await this.dropMessages({ conversationId: c._id });
      await this.conversations.deleteOne({ _id: c._id });
      return;
    }
    await this.conversations.updateOne({ _id: c._id }, { $set: { sourceKind: source.kind, sourceId: source.id, carId, context } });
  }

  // ---- відкриття чату ----

  /**
   * Знаходить або створює розмову під конкретний запит, пропозицію чи оренду (оренда веде до того ж запиту чи
   * пропозиції, з яких вона виникла). Писати можна лише там, де є активна домовленість або оренда.
   */
  async open(user: AuthUser, dto: OpenChatDto) {
    const given = [dto.rentalId, dto.offerId, dto.dealId].filter(Boolean);
    if (given.length !== 1) throw new BadRequestException('Вкажіть запит, пропозицію або оренду');

    let source: Source;
    let ownerId: Types.ObjectId;
    let renterId: Types.ObjectId;
    let context: ChatContext;
    let carId: Types.ObjectId;
    if (dto.rentalId) {
      const r = await this.rentals.findOne({ _id: dto.rentalId, ...this.mine(user), status: { $in: ['pending', 'accepted'] } }).exec();
      if (!r) throw new NotFoundException('Запит не знайдено або він уже закритий');
      source = { kind: 'request', id: r._id };
      ({ ownerId, renterId, carId } = r);
      context = { title: r.car.title, photoUri: r.car.photoUri, city: r.car.city, pricePerDay: r.car.pricePerDay, startDate: r.startDate, endDate: r.endDate };
    } else if (dto.offerId) {
      const o = await this.offers.findOne({ _id: dto.offerId, ...this.mine(user), status: { $in: ['pending', 'accepted'] } }).exec();
      if (!o) throw new NotFoundException('Пропозицію не знайдено або вона вже закрита');
      const w = await this.wanted.findById(o.wantedId).exec();
      source = { kind: 'offer', id: o._id };
      ({ ownerId, renterId, carId } = o);
      context = { title: o.car.title, photoUri: o.car.photoUri, city: w?.city ?? '', pricePerDay: o.pricePerDay, startDate: w?.startDate ?? '', endDate: w?.endDate ?? '' };
    } else {
      const d = await this.deals.findOne({ _id: dto.dealId, ...this.mine(user) }).exec();
      if (!d) throw new NotFoundException('Оренду не знайдено');
      source = { kind: d.source as Source['kind'], id: d.sourceId };
      ({ ownerId, renterId, carId } = d);
      context = { title: d.title, photoUri: d.photoUri, city: d.city, pricePerDay: d.pricePerDay, startDate: d.startDate, endDate: d.endDate };
    }

    const upsert = () =>
      this.conversations
        .findOneAndUpdate(
          { sourceKind: source.kind, sourceId: source.id },
          // Повторне відкриття повертає розмову, яку ця сторона раніше видалила
          { $setOnInsert: { ownerId, renterId, carId, context, lastActivityAt: new Date() }, $pull: { hiddenFor: user.role } },
          { upsert: true, returnDocument: 'after' },
        )
        .exec();
    // Якщо обидві сторони відкрили розмову одночасно, друга upsert може впертись у унікальний індекс: повторюємо
    const c = await upsert().catch((e: { code?: number }) => (e.code === 11000 ? upsert() : Promise.reject(e)));
    return (await this.summaries(user, [c]))[0];
  }

  /**
   * Починає розмову автоматично: відкриває чат у контексті щойно створеного запиту чи пропозиції й кидає перше
   * повідомлення від імені автора, щоб сторони одразу могли спілкуватись. Збій чату не повинен ламати сам запит.
   */
  async autoStart(user: AuthUser, context: OpenChatDto, text: string, clientId: string): Promise<string | null> {
    try {
      const chat = await this.open(user, context);
      await this.send(user, chat.id, text, clientId, undefined, true);
      return chat.id;
    } catch (e) {
      this.log.warn(`Авто-повідомлення не надіслано: ${String(e)}`);
      return null;
    }
  }

  // ---- список й історія ----

  async list(user: AuthUser) {
    const items = await this.conversations
      .find({ ...this.mine(user), lastMessage: { $exists: true }, hiddenFor: { $ne: user.role } })
      .sort({ lastActivityAt: -1 })
      .limit(100)
      .exec();
    return this.summaries(user, items);
  }

  async unreadTotal(user: AuthUser) {
    const rows = await this.conversations.aggregate<{ total: number }>([
      { $match: { ...this.matchMine(user), hiddenFor: { $ne: user.role } } },
      { $group: { _id: null, total: { $sum: `$unread.${user.role}` } } },
    ]);
    return { count: rows[0]?.total ?? 0 };
  }

  async get(user: AuthUser, id: string) {
    return (await this.summaries(user, [await this.mineOrThrow(user, id)]))[0];
  }

  /** Повідомлення від нових до старих (лише після видалення розмови цією стороною); `before` — продовження вгору */
  async history(user: AuthUser, id: string, before: string | undefined, limit: number) {
    const c = await this.mineOrThrow(user, id);
    const cleared = c.clearedAt?.[user.role];
    const items = await this.messages
      .find({
        conversationId: c._id,
        ...(before ? { _id: { $lt: before } } : {}),
        ...(cleared ? { createdAt: { $gt: cleared } } : {}),
      })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();
    const page = items.slice(0, limit);
    return { items: page.map((m) => this.messageView(m, user.id)), hasMore: items.length > limit };
  }

  /**
   * Видалити розмову зі свого списку разом з історією для себе. Співрозмовник її зберігає; нове повідомлення
   * від нього поверне розмову (вже без старих повідомлень). Коли видалили обидві сторони, вона зникає назовсім.
   */
  async remove(user: AuthUser, id: string) {
    const c = await this.mineOrThrow(user, id);
    const updated = await this.conversations
      .findOneAndUpdate({ _id: c._id }, { $addToSet: { hiddenFor: user.role }, $set: { [`clearedAt.${user.role}`]: new Date(), [`unread.${user.role}`]: 0 } }, { returnDocument: 'after', timestamps: false })
      .exec();
    if (updated?.hiddenFor.includes('owner') && updated.hiddenFor.includes('renter')) {
      await this.dropMessages({ conversationId: c._id });
      await this.conversations.deleteOne({ _id: c._id });
    }
    this.gateway.emitTo([user.id], 'removed', { conversationId: String(c._id) });
  }

  // ---- файли ----

  /** Завантажує файл у розмову (до 10 МБ); у повідомлення його додають окремим запитом надсилання, поки не надіслано — лежить не довше доби */
  async uploadFile(user: AuthUser, id: string, file: { originalname: string; size: number; buffer: Buffer } | undefined) {
    const c = await this.mineOrThrow(user, id);
    await this.moderation.assertNotBlocked(String(c.ownerId), String(c.renterId), 'Писати цьому користувачу неможливо: один із вас заблокував іншого');
    if (!(await this.infoFor([c])).get(String(c._id))?.canSend) throw new ForbiddenException('Чат закрито: за цим запитом уже немає активної домовленості');
    let checked: ReturnType<typeof checkChatFile>;
    try {
      checked = checkChatFile(file);
    } catch (e) {
      if (e instanceof ChatFileError) throw new BadRequestException(e.message);
      throw e;
    }
    const saved = await this.chatFiles.create({ conversationId: c._id, uploaderId: user.id, name: checked.name, mime: checked.mime, size: file!.buffer.length, data: file!.buffer });
    return { fileId: String(saved._id), name: saved.name, size: saved.size };
  }

  /** Файл із розмови: лише її учасникам (і автору, поки не надіслано) */
  async downloadFile(user: AuthUser, id: string, fileId: string) {
    const c = await this.mineOrThrow(user, id);
    const f = await this.chatFiles.findOne({ _id: fileId, conversationId: c._id, $or: [{ messageId: { $exists: true } }, { uploaderId: user.id }] }).lean().exec();
    if (!f) throw new NotFoundException('Файл не знайдено');
    return { data: binaryToBuffer(f.data), mime: f.mime, name: f.name };
  }

  // ---- надсилання й читання ----

  async send(user: AuthUser, id: string, rawText: string, clientId?: string, rawAttachments?: { url?: string; fileId?: string; name: string; size: number }[], system = false) {
    const text = cleanMessage(rawText) ?? '';
    const fileIds = (rawAttachments ?? []).filter((a) => a.fileId).map((a) => a.fileId!);
    if ((rawAttachments ?? []).some((a) => !a.url && !a.fileId)) throw new BadRequestException('Невірне вкладення');
    if ((rawAttachments?.length ?? 0) > 5) throw new BadRequestException('Можна додати до 5 вкладень за раз');
    let attachments: Attachment[];
    try {
      attachments = parseAttachments((rawAttachments ?? []).filter((a) => a.url), this.config.get<string>('CLOUDINARY_CLOUD_NAME'), user.id);
    } catch (e) {
      if (e instanceof AttachmentError) throw new BadRequestException(e.message);
      throw e;
    }
    if (!text && !attachments.length && !fileIds.length) throw new BadRequestException('Напишіть повідомлення або додайте файл');
    const c = await this.mineOrThrow(user, id);
    await this.moderation.assertNotBlocked(String(c.ownerId), String(c.renterId), 'Писати цьому користувачу неможливо: один із вас заблокував іншого');
    if (!(await this.infoFor([c])).get(String(c._id))?.canSend) throw new ForbiddenException('Чат закрито: за цим запитом уже немає активної домовленості');

    // Файли, завантажені на сервер: мають бути вашими, з цієї розмови й ще не прикріпленими до повідомлення
    if (fileIds.length) {
      if (new Set(fileIds).size !== fileIds.length) throw new BadRequestException('Те саме вкладення додано двічі');
      const owned = await this.chatFiles.find({ _id: { $in: fileIds }, uploaderId: user.id, conversationId: c._id, messageId: { $exists: false } }, '-data').lean().exec();
      if (owned.length !== fileIds.length) throw new BadRequestException('Файл не знайдено: завантажте його ще раз');
      for (const f of owned) attachments.push({ kind: 'file', url: '', name: f.name, size: f.size, fileId: String(f._id) });
    }

    // Повторна відправка з тим самим clientId повертає вже збережене повідомлення
    if (clientId) {
      const existing = await this.messages.findOne({ conversationId: c._id, senderId: user.id, clientId }).exec();
      if (existing) return this.messageView(existing, user.id);
    }

    let message: MessageDocument;
    try {
      message = await this.messages.create({ conversationId: c._id, senderId: user.id, text, attachments: attachments.map((a) => ({ ...a, fileId: a.fileId ? new Types.ObjectId(a.fileId) : undefined })), clientId, ...(system ? { system: true } : {}) });
      if (fileIds.length) await this.chatFiles.updateMany({ _id: { $in: fileIds } }, { $set: { messageId: message._id } });
    } catch (e) {
      // Гонка двох однакових відправок: unique-індекс залишає одну, повертаємо її
      const dup = clientId ? await this.messages.findOne({ conversationId: c._id, senderId: user.id, clientId }).exec() : null;
      if (dup) return this.messageView(dup, user.id);
      throw e;
    }

    const other: Side = user.role === 'owner' ? 'renter' : 'owner';
    const updated = await this.conversations
      .findOneAndUpdate(
        { _id: c._id },
        {
          $set: { lastMessage: { text: preview(text || attachmentsLabel(attachments), 200), senderId: new Types.ObjectId(user.id), at: message.createdAt }, lastActivityAt: message.createdAt },
          $inc: { [`unread.${other}`]: 1 },
          // Нове повідомлення повертає розмову співрозмовнику, який її видаляв
          $pull: { hiddenFor: other },
        },
        { returnDocument: 'after' },
      )
      .exec();

    const recipient = String(user.role === 'owner' ? c.renterId : c.ownerId);
    this.gateway.emitTo([user.id, recipient], 'message', {
      conversationId: String(c._id),
      message: this.messageView(message, user.id),
      senderId: user.id,
      unread: updated?.unread,
    });
    return this.messageView(message, user.id);
  }

  /** Своє, не службове й не видалене повідомлення цієї розмови */
  private async ownMessage(user: AuthUser, id: string, messageId: string) {
    const c = await this.mineOrThrow(user, id);
    const m = await this.messages.findOne({ _id: messageId, conversationId: c._id }).exec();
    if (!m || m.deletedAt) throw new NotFoundException('Повідомлення не знайдено');
    if (String(m.senderId) !== user.id) throw new ForbiddenException('Можна змінювати лише свої повідомлення');
    if (m.system) throw new ForbiddenException('Службове повідомлення про домовленість змінити не можна');
    return { c, m };
  }

  /** Після зміни чи видалення оновлює прев'ю в списку розмов, якщо це було останнє повідомлення, і розсилає подію обом сторонам */
  private async publishChange(c: ConversationDocument, m: MessageDocument, user: AuthUser, previewText: string) {
    if (c.lastMessage && String(c.lastMessage.senderId) === user.id && c.lastMessage.at.getTime() === m.createdAt.getTime()) {
      await this.conversations.updateOne({ _id: c._id }, { $set: { 'lastMessage.text': preview(previewText, 200) } }).exec();
    }
    const recipient = String(user.role === 'owner' ? c.renterId : c.ownerId);
    this.gateway.emitTo([user.id, recipient], 'message', { conversationId: String(c._id), message: this.messageView(m, user.id), senderId: user.id });
  }

  /** Змінює текст свого повідомлення: протягом 15 хвилин, лише коли воно має текст; з позначкою «змінено» */
  async editMessage(user: AuthUser, id: string, messageId: string, rawText: string) {
    const { c, m } = await this.ownMessage(user, id, messageId);
    if (!canEditMessage(m.createdAt)) throw new BadRequestException('Змінити повідомлення можна лише протягом 15 хвилин після відправки');
    const text = cleanMessage(rawText);
    if (!text) throw new BadRequestException('Текст не може бути порожнім: щоб прибрати повідомлення, видаліть його');
    if (text === m.text) return this.messageView(m, user.id);
    m.text = text;
    m.editedAt = new Date();
    await m.save();
    await this.publishChange(c, m, user, text);
    return this.messageView(m, user.id);
  }

  /** Видаляє своє повідомлення для обох: текст і вкладення стираються (файли з хмари теж), лишається слід «Повідомлення видалено» */
  async deleteMessage(user: AuthUser, id: string, messageId: string) {
    const { c, m } = await this.ownMessage(user, id, messageId);
    const urls = (m.attachments ?? []).map((a) => a.url).filter(Boolean);
    const fileIds = (m.attachments ?? []).map((a) => a.fileId).filter(Boolean);
    m.text = '';
    m.attachments = [];
    m.deletedAt = new Date();
    await m.save();
    if (urls.length) void this.media.release(urls);
    if (fileIds.length) await this.chatFiles.deleteMany({ _id: { $in: fileIds } });
    await this.publishChange(c, m, user, DELETED_PREVIEW);
    return this.messageView(m, user.id);
  }

  /** Позначає чат прочитаним і повідомляє співрозмовника */
  async markRead(user: AuthUser, id: string) {
    const c = await this.mineOrThrow(user, id);
    const at = new Date();
    await this.conversations.updateOne({ _id: c._id }, { $set: { [`unread.${user.role}`]: 0, [`lastReadAt.${user.role}`]: at } }).exec();
    const other = String(user.role === 'owner' ? c.renterId : c.ownerId);
    this.gateway.emitTo([other, user.id], 'read', { conversationId: String(c._id), by: user.role, at: at.toISOString() });
  }

  /** «Друкує…»: лише співрозмовнику */
  async notifyTyping(userId: string, conversationId: string) {
    if (!Types.ObjectId.isValid(conversationId)) return;
    const c = await this.conversations.findOne({ _id: conversationId, $or: [{ ownerId: userId }, { renterId: userId }] }, 'ownerId renterId').lean().exec();
    if (!c) return;
    const other = String(c.ownerId) === userId ? c.renterId : c.ownerId;
    this.gateway.emitTo([String(other)], 'typing', { conversationId, userId });
  }

  /**
   * Прибирає розмови, які більше нічого не дають: без повідомлень (відкрили й не написали) або без активної
   * домовленості (запит відхилено, оренда завершена чи розірвана), якщо в них давно нічого не писали.
   */
  async purgeInactive(cutoff: Date, limit = 200) {
    // Файли, завантажені на сервер і так не надіслані, лежать не довше доби
    await this.chatFiles.deleteMany({ messageId: { $exists: false }, createdAt: { $lt: new Date(Date.now() - 86_400_000) } }).exec();
    const idle = await this.conversations
      .find({ $or: [{ lastActivityAt: { $lt: cutoff } }, { lastMessage: { $exists: false }, createdAt: { $lt: new Date(Date.now() - 86_400_000) } }] })
      .limit(limit)
      .exec();
    if (!idle.length) return 0;
    const info = await this.infoFor(idle);
    const dead = idle.filter((c) => !c.lastMessage || !['pending', 'accepted', 'signing', 'upcoming', 'active'].includes(info.get(String(c._id))?.stage ?? 'closed'));
    if (!dead.length) return 0;
    const ids = dead.map((c) => c._id);
    await this.dropMessages({ conversationId: { $in: ids } });
    await this.conversations.deleteMany({ _id: { $in: ids } });
    return dead.length;
  }

  // ---- допоміжне ----

  private mine(user: AuthUser) {
    return user.role === 'owner' ? { ownerId: user.id } : { renterId: user.id };
  }

  private matchMine(user: AuthUser) {
    const id = new Types.ObjectId(user.id);
    return user.role === 'owner' ? { ownerId: id } : { renterId: id };
  }

  private async mineOrThrow(user: AuthUser, id: string) {
    const c = await this.conversations.findOne({ _id: id, ...this.mine(user) }).exec();
    if (!c) throw new NotFoundException('Чат не знайдено');
    return c;
  }

  /**
   * Стан кожної розмови одним пакетом запитів: етап домовленості (запит, пропозиція чи оренда, що з них виросла),
   * чи можна писати й чи відкрито повне ім'я. Писати можна, поки запит чи пропозиція очікують або прийняті, а
   * коли вони вже стали орендою (навіть розірваною), для розрахунків теж.
   */
  private async infoFor(items: ConversationDocument[]) {
    const withSource = items.filter((c) => c.sourceKind && c.sourceId);
    const ids = (kind: string) => withSource.filter((c) => c.sourceKind === kind).map((c) => c.sourceId!);
    const [deals, rentals, offers] = await Promise.all([
      withSource.length ? this.deals.find({ $or: withSource.map((c) => ({ source: c.sourceKind, sourceId: c.sourceId })) }).lean().exec() : [],
      ids('request').length ? this.rentals.find({ _id: { $in: ids('request') } }, 'status').lean().exec() : [],
      ids('offer').length ? this.offers.find({ _id: { $in: ids('offer') } }, 'status wantedId').lean().exec() : [],
    ]);
    const dealBy = new Map(deals.map((d) => [key(d.source, d.sourceId), d]));
    const wantedBy = new Map(offers.map((o) => [key('offer', o._id), String(o.wantedId)]));
    const statusBy = new Map<string, string>([...rentals.map((r) => [key('request', r._id), r.status] as const), ...offers.map((o) => [key('offer', o._id), o.status] as const)]);
    const today = todayUtc();

    const result = new Map<string, Info>();
    for (const c of items) {
      const k = key(c.sourceKind, c.sourceId);
      const deal = dealBy.get(k);
      const status = statusBy.get(k);
      let stage = 'closed';
      if (deal) stage = dealStageOf(deal, today);
      else if (status) stage = status;
      result.set(String(c._id), { stage, dealId: deal ? String(deal._id) : null, wantedId: wantedBy.get(k) ?? null, canSend: !!deal || status === 'pending' || status === 'accepted', full: !!deal || status === 'accepted' });
    }
    return result;
  }

  private async people(ids: Types.ObjectId[]) {
    const unique = [...new Set(ids.map(String))];
    const users = await this.users.find({ _id: { $in: unique } }, 'firstName lastName phone photoUri').lean().exec();
    return new Map<string, Person>(users.map((u) => [String(u._id), u]));
  }

  private async summaries(user: AuthUser, items: ConversationDocument[]) {
    const role = user.role;
    const [people, info, blocks] = await Promise.all([this.people(items.map((c) => (role === 'owner' ? c.renterId : c.ownerId))), this.infoFor(items), this.moderation.blockDirections(user.id)]);
    const other: Side = role === 'owner' ? 'renter' : 'owner';
    const fallback = role === 'owner' ? 'Орендар' : 'Власник';
    return items.map((c) => {
      const otherId = role === 'owner' ? c.renterId : c.ownerId;
      const p = people.get(String(otherId));
      const i = info.get(String(c._id))!;
      const blockedByMe = blocks.byMe.has(String(otherId));
      const blocked = blockedByMe || blocks.byThem.has(String(otherId));
      const name = p ? (i.full ? fullName(p.firstName, p.lastName) : maskedName(p.firstName, p.lastName)) || fallback : fallback;
      const cleared = c.clearedAt?.[role];
      const last = c.lastMessage && (!cleared || c.lastMessage.at > cleared) ? c.lastMessage : null;
      return {
        id: String(c._id),
        // Номер телефону відкритий лише тут і лише після домовленості (прийнято запит чи пропозицію, або є оренда)
        counterpart: { id: String(otherId), name, phone: i.full && p?.phone ? p.phone : null, photoUri: p?.photoUri || null },
        /** Авто й умови, про які розмова: показуються в шапці чату */
        context: c.context
          ? {
              title: c.context.title,
              photoUri: c.context.photoUri ?? null,
              city: c.context.city,
              pricePerDay: c.context.pricePerDay,
              startDate: c.context.startDate,
              endDate: c.context.endDate,
              carId: c.carId ? String(c.carId) : null,
            }
          : null,
        /** Етап: pending/accepted/declined/…, а після оренди upcoming/active/finished/terminated */
        stage: i.stage,
        dealId: i.dealId,
        /** Звідки розмова: запит на оголошення чи пропозиція на заявку (для переходу з чату) */
        source: c.sourceKind ? { kind: c.sourceKind, wantedId: i.wantedId } : null,
        lastMessage: last ? { text: last.text, mine: String(last.senderId) !== String(otherId), at: last.at } : null,
        unread: c.unread?.[role] ?? 0,
        /** Коли співрозмовник востаннє читав чат: за цим застосунок показує «прочитано» */
        otherReadAt: c.lastReadAt?.[other] ?? null,
        // Блокування в будь-який бік закриває написання. Заблокований не бачить, хто саме заблокував: blockedByMe лише для автора блокування
        canSend: i.canSend && !blocked,
        blocked,
        blockedByMe,
        lastActivityAt: c.lastActivityAt,
      };
    });
  }

  private messageView(m: MessageDocument, viewerId: string) {
    return {
      id: String(m._id),
      conversationId: String(m.conversationId),
      mine: String(m.senderId) === viewerId,
      text: m.text ?? '',
      attachments: (m.attachments ?? []).map((a) => ({ kind: a.kind, url: a.url, name: a.name, size: a.size, fileId: a.fileId ? String(a.fileId) : null })),
      createdAt: m.createdAt,
      clientId: m.clientId ?? null,
      system: !!m.system,
      editedAt: m.editedAt ?? null,
      deletedAt: m.deletedAt ?? null,
    };
  }

  /** Видаляє повідомлення за умовою й прибирає їхні вкладення з хмари (якщо на них більше ніхто не посилається) */
  private async dropMessages(filter: Record<string, unknown>) {
    const withFiles = await this.messages.find({ ...filter, 'attachments.0': { $exists: true } }, 'attachments').lean().exec();
    await this.messages.deleteMany(filter);
    const urls = withFiles.flatMap((m) => (m.attachments ?? []).map((a) => a.url)).filter(Boolean);
    if (urls.length) void this.media.release(urls);
    // Файли на нашому сервері видаляються разом з повідомленнями
    const fileIds = withFiles.flatMap((m) => (m.attachments ?? []).map((a) => a.fileId)).filter(Boolean);
    if (fileIds.length) await this.chatFiles.deleteMany({ _id: { $in: fileIds } });
  }
}
