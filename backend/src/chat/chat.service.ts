import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';

import type { AuthUser } from '../common/current-user';
import { fullName, maskedName, todayUtc } from '../rentals/rentals.math';
import { Conversation, type ChatContext, type ConversationDocument } from '../schemas/conversation.schema';
import { Deal } from '../schemas/deal.schema';
import { Message, type MessageDocument } from '../schemas/message.schema';
import { Offer } from '../schemas/offer.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { WantedRequest } from '../schemas/wanted-request.schema';
import { User } from '../schemas/user.schema';
import type { OpenChatDto } from './chat.dto';
import { ChatGateway } from './chat.gateway';
import { cleanMessage, preview } from './chat.math';

type Side = 'owner' | 'renter';
type Person = { firstName: string; lastName: string };
type Source = { kind: 'request' | 'offer'; id: Types.ObjectId };
/** Стан розмови: чи можна писати, чи відкрито повне ім'я й на якому етапі домовленість */
type Info = { stage: string; dealId: string | null; canSend: boolean; full: boolean };

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
    private readonly gateway: ChatGateway,
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
      await this.messages.deleteMany({ conversationId: c._id });
      await this.conversations.deleteOne({ _id: c._id });
      return;
    }
    const taken = await this.conversations.exists({ sourceKind: source.kind, sourceId: source.id });
    if (taken) {
      await this.messages.deleteMany({ conversationId: c._id });
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
      await this.messages.deleteMany({ conversationId: c._id });
      await this.conversations.deleteOne({ _id: c._id });
    }
    this.gateway.emitTo([user.id], 'removed', { conversationId: String(c._id) });
  }

  // ---- надсилання й читання ----

  async send(user: AuthUser, id: string, rawText: string, clientId?: string) {
    const text = cleanMessage(rawText);
    if (!text) throw new BadRequestException('Напишіть повідомлення');
    const c = await this.mineOrThrow(user, id);
    if (!(await this.infoFor([c])).get(String(c._id))?.canSend) throw new ForbiddenException('Чат закрито: за цим запитом уже немає активної домовленості');

    // Повторна відправка з тим самим clientId повертає вже збережене повідомлення
    if (clientId) {
      const existing = await this.messages.findOne({ conversationId: c._id, senderId: user.id, clientId }).exec();
      if (existing) return this.messageView(existing, user.id);
    }

    let message: MessageDocument;
    try {
      message = await this.messages.create({ conversationId: c._id, senderId: user.id, text, clientId });
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
          $set: { lastMessage: { text: preview(text, 200), senderId: new Types.ObjectId(user.id), at: message.createdAt }, lastActivityAt: message.createdAt },
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
      ids('offer').length ? this.offers.find({ _id: { $in: ids('offer') } }, 'status').lean().exec() : [],
    ]);
    const dealBy = new Map(deals.map((d) => [key(d.source, d.sourceId), d]));
    const statusBy = new Map<string, string>([...rentals.map((r) => [key('request', r._id), r.status] as const), ...offers.map((o) => [key('offer', o._id), o.status] as const)]);
    const today = todayUtc();

    const result = new Map<string, Info>();
    for (const c of items) {
      const k = key(c.sourceKind, c.sourceId);
      const deal = dealBy.get(k);
      const status = statusBy.get(k);
      let stage = 'closed';
      if (deal) stage = deal.status === 'terminated' ? 'terminated' : today > deal.endDate ? 'finished' : today < deal.startDate ? 'upcoming' : 'active';
      else if (status) stage = status;
      result.set(String(c._id), { stage, dealId: deal ? String(deal._id) : null, canSend: !!deal || status === 'pending' || status === 'accepted', full: !!deal || status === 'accepted' });
    }
    return result;
  }

  private async people(ids: Types.ObjectId[]) {
    const unique = [...new Set(ids.map(String))];
    const users = await this.users.find({ _id: { $in: unique } }, 'firstName lastName').lean().exec();
    return new Map<string, Person>(users.map((u) => [String(u._id), u]));
  }

  private async summaries(user: AuthUser, items: ConversationDocument[]) {
    const role = user.role;
    const [people, info] = await Promise.all([this.people(items.map((c) => (role === 'owner' ? c.renterId : c.ownerId))), this.infoFor(items)]);
    const other: Side = role === 'owner' ? 'renter' : 'owner';
    const fallback = role === 'owner' ? 'Орендар' : 'Власник';
    return items.map((c) => {
      const otherId = role === 'owner' ? c.renterId : c.ownerId;
      const p = people.get(String(otherId));
      const i = info.get(String(c._id))!;
      const name = p ? (i.full ? fullName(p.firstName, p.lastName) : maskedName(p.firstName, p.lastName)) || fallback : fallback;
      const cleared = c.clearedAt?.[role];
      const last = c.lastMessage && (!cleared || c.lastMessage.at > cleared) ? c.lastMessage : null;
      return {
        id: String(c._id),
        counterpart: { id: String(otherId), name },
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
        lastMessage: last ? { text: last.text, mine: String(last.senderId) !== String(otherId), at: last.at } : null,
        unread: c.unread?.[role] ?? 0,
        /** Коли співрозмовник востаннє читав чат: за цим застосунок показує «прочитано» */
        otherReadAt: c.lastReadAt?.[other] ?? null,
        canSend: i.canSend,
        lastActivityAt: c.lastActivityAt,
      };
    });
  }

  private messageView(m: MessageDocument, viewerId: string) {
    return { id: String(m._id), conversationId: String(m.conversationId), mine: String(m.senderId) === viewerId, text: m.text, createdAt: m.createdAt, clientId: m.clientId ?? null };
  }
}
