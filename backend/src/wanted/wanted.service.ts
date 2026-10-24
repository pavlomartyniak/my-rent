import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';

import { escapeRegex, normalize } from '../common/normalize';
import { maskedName, rentalDays, todayUtc, validateRange } from '../rentals/rentals.math';
import { Offer } from '../schemas/offer.schema';
import { User } from '../schemas/user.schema';
import { WantedRequest, type WantedRequestDocument } from '../schemas/wanted-request.schema';
import type { BoardQuery, CreateWantedDto } from './wanted.dto';

const MAX_OPEN_PER_RENTER = 5;

type Counts = { pending: number; total: number };

/** Заявка для клієнта; `renter` — ім'я з ініціалом, повні контакти ніколи не показуються на дошці */
export function wantedView(w: WantedRequestDocument, extra: { renter?: string; offers?: Counts; myOffer?: boolean } = {}) {
  return {
    id: String(w._id),
    brand: w.brand,
    model: w.model,
    city: w.city,
    startDate: w.startDate,
    endDate: w.endDate,
    days: rentalDays(w.startDate, w.endDate),
    maxPricePerDay: w.maxPricePerDay ?? null,
    notes: w.notes,
    status: w.status,
    createdAt: w.createdAt,
    ...extra,
  };
}

@Injectable()
export class WantedService {
  constructor(
    @InjectModel(WantedRequest.name) private readonly wanted: Model<WantedRequest>,
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async create(renterId: string, dto: CreateWantedDto) {
    const today = todayUtc();
    const rangeError = validateRange(dto.startDate, dto.endDate, today);
    if (rangeError) throw new BadRequestException(rangeError);
    if (dto.model && !dto.brand) throw new BadRequestException('Спочатку вкажіть марку, а потім модель');
    const cityKey = normalize(dto.city);
    if (!cityKey) throw new BadRequestException('Вкажіть місто');

    const renter = await this.users.findById(renterId).exec();
    if (!renter) throw new NotFoundException('Користувача не знайдено');
    if (!renter.firstName || !renter.lastName) throw new BadRequestException('Заповніть ім’я й прізвище в профілі, щоб створювати заявки');

    if ((await this.wanted.countDocuments({ renterId, status: 'open', endDate: { $gte: today } })) >= MAX_OPEN_PER_RENTER) {
      throw new ConflictException(`Одночасно можна мати до ${MAX_OPEN_PER_RENTER} відкритих заявок`);
    }

    const created = await this.wanted.create({
      renterId,
      brand: dto.brand ?? '',
      model: dto.model ?? '',
      city: dto.city,
      cityKey,
      startDate: dto.startDate,
      endDate: dto.endDate,
      maxPricePerDay: dto.maxPricePerDay,
      notes: dto.notes ?? '',
    });
    return wantedView(created, { offers: { pending: 0, total: 0 } });
  }

  /** Мої заявки з кількістю пропозицій */
  async mine(renterId: string) {
    const items = await this.wanted.find({ renterId }).sort({ createdAt: -1 }).limit(100).exec();
    const counts = await this.offerCounts(items.map((w) => w._id));
    return items.map((w) => wantedView(w, { offers: counts.get(String(w._id)) ?? { pending: 0, total: 0 } }));
  }

  /** Дошка заявок для власників: відкриті й актуальні, за містом і маркою/моделлю */
  async board(ownerId: string, query: BoardQuery) {
    const filter: Record<string, unknown> = { status: 'open', endDate: { $gte: todayUtc() } };
    const cityKey = normalize(query.city ?? '');
    if (cityKey) filter['cityKey'] = { $regex: escapeRegex(cityKey) };
    const q = (query.q ?? '').trim();
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: 'i' };
      filter['$or'] = [{ brand: rx }, { model: rx }];
    }

    const [total, items] = await Promise.all([
      this.wanted.countDocuments(filter),
      this.wanted
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
    ]);
    const [renters, mine] = await Promise.all([
      this.users.find({ _id: { $in: items.map((w) => w.renterId) } }, 'firstName lastName').lean().exec(),
      this.offers.find({ ownerId, wantedId: { $in: items.map((w) => w._id) }, status: { $in: ['pending', 'accepted'] } }, 'wantedId').lean().exec(),
    ]);
    const names = new Map(renters.map((u) => [String(u._id), maskedName(u.firstName, u.lastName)]));
    const offered = new Set(mine.map((o) => String(o.wantedId)));

    return {
      page: query.page,
      pages: Math.max(1, Math.ceil(total / query.limit)),
      total,
      items: items.map((w) => wantedView(w, { renter: names.get(String(w.renterId)) ?? '', myOffer: offered.has(String(w._id)) })),
    };
  }

  /** Одна відкрита заявка для власника (екран «Запропонувати авто») */
  async getForOwner(ownerId: string, id: string) {
    const w = await this.wanted.findOne({ _id: id, status: 'open', endDate: { $gte: todayUtc() } }).exec();
    if (!w) throw new NotFoundException('Заявка вже закрита або недоступна');
    const [renter, mine] = await Promise.all([
      this.users.findById(w.renterId, 'firstName lastName').lean().exec(),
      this.offers.exists({ ownerId, wantedId: w._id, status: { $in: ['pending', 'accepted'] } }),
    ]);
    return wantedView(w, { renter: renter ? maskedName(renter.firstName, renter.lastName) : '', myOffer: !!mine });
  }

  /** Скасувати заявку; пропозиції, що очікували, відхиляються */
  async cancel(renterId: string, id: string) {
    const w = await this.wanted.findOneAndUpdate({ _id: id, renterId, status: 'open' }, { $set: { status: 'cancelled' } }, { returnDocument: 'after' }).exec();
    if (!w) {
      if (await this.wanted.exists({ _id: id, renterId })) throw new ConflictException('Заявку вже закрито');
      throw new NotFoundException('Заявку не знайдено');
    }
    await this.offers.updateMany({ wantedId: w._id, status: 'pending' }, { $set: { status: 'declined', decisionNote: 'Заявку скасовано', respondedAt: new Date() } });
    return wantedView(w, { offers: (await this.offerCounts([w._id])).get(String(w._id)) ?? { pending: 0, total: 0 } });
  }

  async offerCounts(ids: Types.ObjectId[]) {
    const rows = await this.offers.aggregate<{ _id: { wantedId: Types.ObjectId; status: string }; n: number }>([
      { $match: { wantedId: { $in: ids } } },
      { $group: { _id: { wantedId: '$wantedId', status: '$status' }, n: { $sum: 1 } } },
    ]);
    const result = new Map<string, Counts>();
    for (const r of rows) {
      const key = String(r._id.wantedId);
      const c = result.get(key) ?? { pending: 0, total: 0 };
      // Відкликані пропозиції не рахуємо: орендар їх не бачить
      if (r._id.status !== 'withdrawn') c.total += r.n;
      if (r._id.status === 'pending') c.pending += r.n;
      result.set(key, c);
    }
    return result;
  }
}
