import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';

import type { AuthUser } from '../common/current-user';
import { MailService } from '../mail/mail.service';
import { maskedName } from '../rentals/rentals.math';
import { Block } from '../schemas/block.schema';
import { Car } from '../schemas/car.schema';
import { Conversation } from '../schemas/conversation.schema';
import { Message } from '../schemas/message.schema';
import { Report } from '../schemas/report.schema';
import { User } from '../schemas/user.schema';
import { DEFAULT_MODERATION_EMAIL, SUSPENDED_CACHE_MS } from './moderation.constants';
import type { CreateBlockDto, CreateReportDto } from './moderation.dto';
import { counterpartIds, makeSnapshot } from './moderation.pure';

/**
 * Скарги й блокування користувачів. Скарга зберігається разом із знімком змісту й надсилається модератору на пошту;
 * модератор розглядає її скриптом `npm run moderate` (приховати оголошення, призупинити акаунт).
 */
@Injectable()
export class ModerationService {
  private readonly log = new Logger(ModerationService.name);
  private suspended = new Set<string>();
  private suspendedLoadedAt = 0;

  constructor(
    @InjectModel(Block.name) private readonly blocks: Model<Block>,
    @InjectModel(Report.name) private readonly reports: Model<Report>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Message.name) private readonly messages: Model<Message>,
    @InjectModel(Conversation.name) private readonly conversations: Model<Conversation>,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  // ---- призупинені акаунти ----

  /** Чи призупинено акаунт модератором. Список кешується на хвилину, тож дія модератора набирає чинності майже одразу */
  async isSuspended(userId: string) {
    if (Date.now() - this.suspendedLoadedAt > SUSPENDED_CACHE_MS) {
      try {
        const rows = await this.users.find({ suspended: true }, '_id').lean().exec();
        this.suspended = new Set(rows.map((r) => String(r._id)));
        this.suspendedLoadedAt = Date.now();
      } catch (e) {
        this.log.warn(`Не вдалося оновити список призупинених акаунтів: ${String(e)}`);
      }
    }
    return this.suspended.has(userId);
  }

  // ---- блокування ----

  /** Ідентифікатори користувачів, з якими в цього є блокування в будь-який бік */
  async blockedWith(userId: string): Promise<string[]> {
    const rows = await this.blocks.find({ $or: [{ blockerId: userId }, { blockedId: userId }] }).lean().exec();
    return counterpartIds(userId, rows);
  }

  /** З ким у користувача є блокування й у який бік: byMe — заблокував він, byThem — заблокували його */
  async blockDirections(userId: string): Promise<{ byMe: Set<string>; byThem: Set<string> }> {
    const rows = await this.blocks.find({ $or: [{ blockerId: userId }, { blockedId: userId }] }).lean().exec();
    const byMe = new Set<string>();
    const byThem = new Set<string>();
    for (const b of rows) {
      if (String(b.blockerId) === userId) byMe.add(String(b.blockedId));
      else byThem.add(String(b.blockerId));
    }
    return { byMe, byThem };
  }

  async isBlocked(a: string, b: string) {
    return !!(await this.blocks.exists({ $or: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }));
  }

  /** Кидає 403, якщо між двома користувачами є блокування в будь-який бік */
  async assertNotBlocked(a: string, b: string, message = 'Взаємодія з цим користувачем недоступна: один із вас заблокував іншого') {
    if (await this.isBlocked(a, b)) throw new ForbiddenException(message);
  }

  async block(user: AuthUser, dto: CreateBlockDto) {
    const targetId = await this.resolveUser(dto.userId, dto.carId);
    if (targetId === user.id) throw new BadRequestException('Не можна заблокувати себе');
    await this.blocks.updateOne({ blockerId: user.id, blockedId: targetId }, { $setOnInsert: { blockerId: user.id, blockedId: targetId } }, { upsert: true }).exec();
    return this.blockedView(targetId);
  }

  async unblock(user: AuthUser, blockedId: string) {
    await this.blocks.deleteOne({ blockerId: user.id, blockedId }).exec();
  }

  async listBlocks(user: AuthUser) {
    const rows = await this.blocks.find({ blockerId: user.id }).sort({ _id: -1 }).lean().exec();
    const people = await this.users.find({ _id: { $in: rows.map((r) => r.blockedId) } }, 'firstName lastName').lean().exec();
    const byId = new Map(people.map((p) => [String(p._id), p]));
    return rows.map((r) => {
      const p = byId.get(String(r.blockedId));
      return { userId: String(r.blockedId), name: p ? maskedName(p.firstName, p.lastName) || 'Користувач' : 'Користувач', blockedAt: r.createdAt };
    });
  }

  // ---- скарги ----

  async report(user: AuthUser, dto: CreateReportDto) {
    let targetUserId: string;
    let carId: string | undefined;
    let messageId: string | undefined;
    let snapshot = '';

    if (dto.kind === 'listing') {
      if (!dto.carId) throw new BadRequestException('Вкажіть оголошення');
      const car = await this.cars.findById(dto.carId).exec();
      if (!car?.listing) throw new NotFoundException('Оголошення не знайдено');
      targetUserId = String(car.userId);
      carId = String(car._id);
      snapshot = makeSnapshot(`${car.brand} ${car.model} ${car.year}, ${car.listing.city}. ${car.listing.description}`);
    } else if (dto.kind === 'user') {
      if (!dto.userId) throw new BadRequestException('Вкажіть користувача');
      if (!(await this.users.exists({ _id: dto.userId }))) throw new NotFoundException('Користувача не знайдено');
      targetUserId = dto.userId;
    } else {
      if (!dto.messageId) throw new BadRequestException('Вкажіть повідомлення');
      const message = await this.messages.findById(dto.messageId).exec();
      // Поскаржитись можна лише на повідомлення зі свого чату
      const chat = message ? await this.conversations.findOne({ _id: message.conversationId, $or: [{ ownerId: user.id }, { renterId: user.id }] }).exec() : null;
      if (!message || !chat) throw new NotFoundException('Повідомлення не знайдено');
      targetUserId = String(message.senderId);
      messageId = String(message._id);
      snapshot = makeSnapshot(message.text);
    }
    if (targetUserId === user.id) throw new BadRequestException('Не можна поскаржитись на себе');

    // Повторна скарга на те саме, поки перша не розглянута, не плодить дублікатів
    const same = { reporterId: user.id, kind: dto.kind, targetUserId, status: 'open', ...(carId ? { carId } : {}), ...(messageId ? { messageId } : {}) };
    const existing = await this.reports.findOne(same).exec();
    if (existing) return { id: String(existing._id), status: existing.status };

    const created = await this.reports.create({
      reporterId: new Types.ObjectId(user.id),
      kind: dto.kind,
      targetUserId: new Types.ObjectId(targetUserId),
      ...(carId ? { carId: new Types.ObjectId(carId) } : {}),
      ...(messageId ? { messageId: new Types.ObjectId(messageId) } : {}),
      reason: dto.reason,
      note: (dto.note ?? '').trim(),
      snapshot,
    });
    this.notifyModerator(created);
    return { id: String(created._id), status: created.status };
  }

  /** Лист модератору про нову скаргу; збій пошти не впливає на прийняття скарги */
  private notifyModerator(report: { _id: unknown; kind: string; reason: string; note: string; snapshot: string; targetUserId: unknown; carId?: unknown }) {
    const to = this.config.get<string>('MODERATION_EMAIL')?.trim() || DEFAULT_MODERATION_EMAIL;
    const lines = [
      `Нова скарга ${String(report._id)}`,
      `Тип: ${report.kind}. Причина: ${report.reason}.`,
      `Користувач, на якого скаржаться: ${String(report.targetUserId)}`,
      ...(report.carId ? [`Оголошення: ${String(report.carId)}`] : []),
      ...(report.note ? [`Коментар скаржника: ${report.note}`] : []),
      ...(report.snapshot ? [`Зміст: ${report.snapshot}`] : []),
      '',
      'Розглянути: npm run moderate -- reports',
    ];
    void this.mail.send(to, `Kolo: нова скарга (${report.kind})`, lines.join('\n')).catch(() => false);
  }

  // ---- службове ----

  /** Видалення акаунта: його блокування й скарги (подані та отримані) стираються разом з ним */
  async purgeUser(userId: string) {
    await this.blocks.deleteMany({ $or: [{ blockerId: userId }, { blockedId: userId }] }).exec();
    await this.reports.deleteMany({ $or: [{ reporterId: userId }, { targetUserId: userId }] }).exec();
  }

  private async blockedView(userId: string) {
    const u = await this.users.findById(userId, 'firstName lastName').lean().exec();
    return { userId, name: u ? maskedName(u.firstName, u.lastName) || 'Користувач' : 'Користувач' };
  }

  private async resolveUser(userId?: string, carId?: string) {
    if (userId) {
      if (!(await this.users.exists({ _id: userId }))) throw new NotFoundException('Користувача не знайдено');
      return userId;
    }
    if (carId) {
      const car = await this.cars.findById(carId, 'userId').lean().exec();
      if (!car) throw new NotFoundException('Оголошення не знайдено');
      return String(car.userId);
    }
    throw new BadRequestException('Вкажіть користувача або оголошення');
  }
}
