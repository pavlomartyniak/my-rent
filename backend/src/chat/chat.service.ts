import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';

import type { AuthUser } from '../common/current-user';
import { fullName, maskedName } from '../rentals/rentals.math';
import { Conversation, type ConversationDocument } from '../schemas/conversation.schema';
import { Deal } from '../schemas/deal.schema';
import { Message, type MessageDocument } from '../schemas/message.schema';
import { Offer } from '../schemas/offer.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { User } from '../schemas/user.schema';
import { ChatGateway } from './chat.gateway';
import { cleanMessage, preview } from './chat.math';
import type { OpenChatDto } from './chat.dto';

type Side = 'owner' | 'renter';
type Person = { firstName: string; lastName: string };

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversations: Model<Conversation>,
    @InjectModel(Message.name) private readonly messages: Model<Message>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly gateway: ChatGateway,
  ) {
    gateway.chat = this;
  }

  // ---- відкриття чату ----

  /**
   * Знаходить або створює чат з людиною, з якою вже є зв'язок: запит на оренду чи пропозиція, що чекає або прийнята,
   * або оренда. Так чат не перетворюється на спам: писати можна лише тим, з ким щось домовляєшся.
   */
  async open(user: AuthUser, dto: OpenChatDto) {
    const given = [dto.rentalId, dto.offerId, dto.dealId].filter(Boolean);
    if (given.length !== 1) throw new BadRequestException('Вкажіть запит, пропозицію або оренду');

    let ownerId: Types.ObjectId;
    let renterId: Types.ObjectId;
    let title = '';
    if (dto.rentalId) {
      const r = await this.rentals.findOne({ _id: dto.rentalId, ...this.mine(user), status: { $in: ['pending', 'accepted'] } }).exec();
      if (!r) throw new NotFoundException('Запит не знайдено або він уже закритий');
      ({ ownerId, renterId } = r);
      title = r.car.title;
    } else if (dto.offerId) {
      const o = await this.offers.findOne({ _id: dto.offerId, ...this.mine(user), status: { $in: ['pending', 'accepted'] } }).exec();
      if (!o) throw new NotFoundException('Пропозицію не знайдено або вона вже закрита');
      ({ ownerId, renterId } = o);
      title = o.car.title;
    } else {
      const d = await this.deals.findOne({ _id: dto.dealId, ...this.mine(user) }).exec();
      if (!d) throw new NotFoundException('Оренду не знайдено');
      ({ ownerId, renterId } = d);
      title = d.title;
    }

    const upsert = () =>
      this.conversations
        .findOneAndUpdate({ ownerId, renterId }, { $set: { contextTitle: title }, $setOnInsert: { lastActivityAt: new Date() } }, { upsert: true, returnDocument: 'after' })
        .exec();
    // Якщо обидві сторони відкрили чат одночасно, друга upsert може впертись у унікальний індекс: повторюємо
    const c = await upsert().catch((e: { code?: number }) => (e.code === 11000 ? upsert() : Promise.reject(e)));
    return this.summaryFor(user, c);
  }

  // ---- список й історія ----

  async list(user: AuthUser) {
    const items = await this.conversations
      .find({ ...this.mine(user), lastMessage: { $exists: true } })
      .sort({ lastActivityAt: -1 })
      .limit(100)
      .exec();
    const people = await this.people(items.map((c) => (user.role === 'owner' ? c.renterId : c.ownerId)));
    const linked = await this.linkedPairs(items);
    return Promise.all(items.map((c) => this.summary(user.role, c, people, linked)));
  }

  async unreadTotal(user: AuthUser) {
    const key = `unread.${user.role}`;
    const rows = await this.conversations.aggregate<{ total: number }>([{ $match: this.matchMine(user) }, { $group: { _id: null, total: { $sum: `$${key}` } } }]);
    return { count: rows[0]?.total ?? 0 };
  }

  async get(user: AuthUser, id: string) {
    return this.summaryFor(user, await this.mineOrThrow(user, id));
  }

  /** Повідомлення від нових до старих; `before` — продовження вгору */
  async history(user: AuthUser, id: string, before: string | undefined, limit: number) {
    const c = await this.mineOrThrow(user, id);
    const items = await this.messages
      .find({ conversationId: c._id, ...(before ? { _id: { $lt: before } } : {}) })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();
    const page = items.slice(0, limit);
    return { items: page.map((m) => this.messageView(m, user.id)), hasMore: items.length > limit };
  }

  // ---- надсилання й читання ----

  async send(user: AuthUser, id: string, rawText: string, clientId?: string) {
    const text = cleanMessage(rawText);
    if (!text) throw new BadRequestException('Напишіть повідомлення');
    const c = await this.mineOrThrow(user, id);
    if (!(await this.canSend(c))) throw new ForbiddenException('Чат закрито: між вами вже немає активної домовленості');

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
        { $set: { lastMessage: { text: preview(text, 200), senderId: new Types.ObjectId(user.id), at: message.createdAt }, lastActivityAt: message.createdAt }, $inc: { [`unread.${other}`]: 1 } },
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

  /** Є ли між людьми активна домовленість, у межах якої можна писати */
  private async canSend(c: Pick<Conversation, 'ownerId' | 'renterId'>) {
    const pair = { ownerId: c.ownerId, renterId: c.renterId };
    const active = { status: { $in: ['pending', 'accepted'] } };
    const [deal, rental, offer] = await Promise.all([this.deals.exists(pair), this.rentals.exists({ ...pair, ...active }), this.offers.exists({ ...pair, ...active })]);
    return !!(deal || rental || offer);
  }

  /** Пари, між якими вже є оренда чи прийнята домовленість: їм відкриваємо повне ім'я */
  private async linkedPairs(items: Pick<Conversation, 'ownerId' | 'renterId'>[]) {
    const keys = new Set<string>();
    if (!items.length) return keys;
    const pairs = items.map((c) => ({ ownerId: c.ownerId, renterId: c.renterId }));
    const [deals, rentals, offers] = await Promise.all([
      this.deals.find({ $or: pairs }, 'ownerId renterId').lean().exec(),
      this.rentals.find({ $or: pairs, status: 'accepted' }, 'ownerId renterId').lean().exec(),
      this.offers.find({ $or: pairs, status: 'accepted' }, 'ownerId renterId').lean().exec(),
    ]);
    for (const d of [...deals, ...rentals, ...offers]) keys.add(`${d.ownerId}:${d.renterId}`);
    return keys;
  }

  private async people(ids: Types.ObjectId[]) {
    const unique = [...new Set(ids.map(String))];
    const users = await this.users.find({ _id: { $in: unique } }, 'firstName lastName').lean().exec();
    return new Map<string, Person>(users.map((u) => [String(u._id), u]));
  }

  private async summaryFor(user: AuthUser, c: ConversationDocument) {
    const people = await this.people([user.role === 'owner' ? c.renterId : c.ownerId]);
    return this.summary(user.role, c, people, await this.linkedPairs([c]));
  }

  private async summary(role: Side, c: ConversationDocument, people: Map<string, Person>, linked: Set<string>) {
    const otherId = role === 'owner' ? c.renterId : c.ownerId;
    const p = people.get(String(otherId));
    const full = linked.has(`${c.ownerId}:${c.renterId}`);
    const fallback = role === 'owner' ? 'Орендар' : 'Власник';
    const name = p ? (full ? fullName(p.firstName, p.lastName) : maskedName(p.firstName, p.lastName)) || fallback : fallback;
    const other: Side = role === 'owner' ? 'renter' : 'owner';
    return {
      id: String(c._id),
      counterpart: { id: String(otherId), name },
      contextTitle: c.contextTitle,
      lastMessage: c.lastMessage ? { text: c.lastMessage.text, mine: String(c.lastMessage.senderId) !== String(otherId), at: c.lastMessage.at } : null,
      unread: c.unread?.[role] ?? 0,
      /** Коли співрозмовник востаннє читав чат: за цим застосунок показує «прочитано» */
      otherReadAt: c.lastReadAt?.[other] ?? null,
      canSend: await this.canSend(c),
      lastActivityAt: c.lastActivityAt,
    };
  }

  private messageView(m: MessageDocument, viewerId: string) {
    return { id: String(m._id), conversationId: String(m.conversationId), mine: String(m.senderId) === viewerId, text: m.text, createdAt: m.createdAt, clientId: m.clientId ?? null };
  }
}
