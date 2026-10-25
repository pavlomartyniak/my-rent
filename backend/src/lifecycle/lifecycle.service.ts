import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ChatService } from '../chat/chat.service';
import { DealsService } from '../deals/deals.service';
import { FINISHED_RETENTION_DAYS } from '../common/constants';
import { todayUtc } from '../rentals/rentals.math';
import { Deal } from '../schemas/deal.schema';
import { Offer } from '../schemas/offer.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { WantedRequest } from '../schemas/wanted-request.schema';

const DAY_MS = 86_400_000;

/**
 * Фонове прибирання, яке тримає список запитів, пропозицій, заявок і розмов у порядку, щоб завершене не «висіло»:
 * 1) прийняті запити й пропозиції, оренда за якими закінчилась за датою, стають «завершеними»;
 * 2) виконані заявки, оренда за якими закінчилась понад 30 днів тому, видаляються;
 * 3) розмови без активної домовленості, у яких давно немає повідомлень, видаляються.
 * (Скасовані, відхилені й завершені запити та пропозиції видаляє індекс бази через 30 днів.)
 */
@Injectable()
export class LifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(LifecycleService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectModel(WantedRequest.name) private readonly wanted: Model<WantedRequest>,
    private readonly chat: ChatService,
    private readonly dealsService: DealsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const every = Number(this.config.get('LIFECYCLE_INTERVAL_MS')) || 60 * 60 * 1000;
    // Перший прохід одразу після старту, далі — щогодини
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), every);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      // Спершу скасовуємо непідписані договори й запускаємо оренди, що почались, а вже тоді завершуємо ті, що закінчились
      const expired = await this.dealsService.expireUnsigned();
      const started = await this.dealsService.startReserved();
      const ended = await this.endFinishedDeals();
      const wanted = await this.purgeOldWanted();
      const chats = await this.chat.purgeInactive(new Date(Date.now() - FINISHED_RETENTION_DAYS * DAY_MS));
      if (expired || started || ended || wanted || chats) {
        this.log.log(`Прибирання: скасовано непідписаних ${expired}, оренд розпочато ${started}, завершено запитів/пропозицій ${ended}, видалено заявок ${wanted}, розмов ${chats}`);
      }
    } catch (e) {
      this.log.warn(`Прибирання не вдалось: ${String(e)}`);
    } finally {
      this.running = false;
    }
  }

  /** Оренда закінчилась за датою чи розірвана: прийнятий запит чи пропозиція, з яких вона виросла, стають завершеними */
  private async endFinishedDeals() {
    // Розірвані оренди теж: так підхоплюються й ті, що були розірвані до появи статусу «завершено»
    const finished = await this.deals.find({ $or: [{ status: 'terminated' }, { endDate: { $lt: todayUtc() } }] }, 'source sourceId').sort({ updatedAt: -1 }).limit(500).lean().exec();
    if (!finished.length) return 0;
    const update = { $set: { status: 'ended', decisionNote: 'Оренду завершено', respondedAt: new Date() } };
    const ids = (kind: string) => finished.filter((d) => d.source === kind).map((d) => d.sourceId);
    const [r, o] = await Promise.all([
      this.rentals.updateMany({ _id: { $in: ids('request') }, status: 'accepted' }, update),
      this.offers.updateMany({ _id: { $in: ids('offer') }, status: 'accepted' }, update),
    ]);
    return r.modifiedCount + o.modifiedCount;
  }

  /** Виконана заявка, оренда з якої закінчилась понад 30 днів тому, більше нікому не потрібна */
  private async purgeOldWanted() {
    const cutoff = new Date(Date.now() - FINISHED_RETENTION_DAYS * DAY_MS);
    const cutoffDay = cutoff.toISOString().slice(0, 10);
    const old = await this.deals
      .find({ source: 'offer', $or: [{ status: 'terminated', terminatedAt: { $lt: cutoff } }, { status: { $ne: 'terminated' }, endDate: { $lt: cutoffDay } }] }, 'sourceId')
      .limit(200)
      .lean()
      .exec();
    if (!old.length) return 0;
    const offers = await this.offers.find({ _id: { $in: old.map((d) => d.sourceId) } }, 'wantedId').lean().exec();
    const wantedIds = offers.map((o) => o.wantedId);
    const gone = await this.wanted.find({ _id: { $in: wantedIds }, status: 'fulfilled' }, '_id').lean().exec();
    if (!gone.length) return 0;
    await this.offers.deleteMany({ wantedId: { $in: gone.map((w) => w._id) } });
    await this.wanted.deleteMany({ _id: { $in: gone.map((w) => w._id) } });
    return gone.length;
  }
}
