import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';

import type { AuthUser } from '../common/current-user';
import { fullName, todayUtc } from '../rentals/rentals.math';
import { Car } from '../schemas/car.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { Deal, type DealDocument } from '../schemas/deal.schema';
import { User } from '../schemas/user.schema';

type Person = { firstName: string; lastName: string; phone: string };

@Injectable()
export class DealsService {
  constructor(
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /** Усі оренди орендаря, новіші першими */
  async list(renterId: string) {
    const items = await this.deals.find({ renterId }).sort({ createdAt: -1 }).limit(200).exec();
    const people = await this.people(items.map((d) => d.ownerId));
    return items.map((d) => this.view(d, 'renter', people));
  }

  async get(renterId: string, id: string) {
    const deal = await this.deals.findOne({ _id: id, renterId }).exec();
    if (!deal) throw new NotFoundException('Оренду не знайдено');
    return this.view(deal, 'renter', await this.people([deal.ownerId]));
  }

  /** Поточна оренда авто власника (діє чи ще не почалась); null — авто не здано через застосунок */
  async activeForCar(ownerId: string, carId: string) {
    const deal = await this.deals.findOne({ ownerId, carId, status: { $ne: 'terminated' }, endDate: { $gte: todayUtc() } }).sort({ createdAt: -1 }).exec();
    if (!deal) return null;
    return this.view(deal, 'owner', await this.people([deal.renterId]));
  }

  /**
   * Дострокове розірвання потребує згоди обох сторін: одна пропонує, друга погоджується чи відхиляє.
   * Після згоди оренда закінчується сьогодні (чи в день початку, якщо ще не почалась), а авто в обліку
   * власника знову стає вільним. Записи й платежі лишаються для розрахунку.
   */
  async proposeTermination(user: AuthUser, id: string, note = '') {
    const deal = await this.mine(user, id);
    this.assertOpen(deal);
    if (deal.terminationRequest) throw new ConflictException('Пропозицію про розірвання вже надіслано');
    deal.terminationRequest = { by: user.role, at: new Date(), note: note.trim() };
    await deal.save();
    return this.viewFor(user, deal);
  }

  /** Автор пропозиції відкликає її */
  async withdrawTermination(user: AuthUser, id: string) {
    const deal = await this.mine(user, id);
    if (deal.terminationRequest?.by !== user.role) throw new ConflictException('Немає вашої пропозиції про розірвання');
    deal.terminationRequest = undefined;
    await deal.save();
    return this.viewFor(user, deal);
  }

  /** Друга сторона відхиляє пропозицію: оренда триває */
  async declineTermination(user: AuthUser, id: string) {
    const deal = await this.mine(user, id);
    if (!deal.terminationRequest || deal.terminationRequest.by === user.role) throw new ConflictException('Немає пропозиції для відповіді');
    deal.terminationRequest = undefined;
    await deal.save();
    return this.viewFor(user, deal);
  }

  /** Друга сторона погоджується: оренду розірвано */
  async acceptTermination(user: AuthUser, id: string) {
    const session = await this.connection.startSession();
    let result: DealDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const deal = await this.deals.findOne({ _id: id, ...this.side(user) }, null, { session }).exec();
        if (!deal) throw new NotFoundException('Оренду не знайдено');
        this.assertOpen(deal);
        const proposal = deal.terminationRequest;
        if (!proposal || proposal.by === user.role) throw new ConflictException('Немає пропозиції для відповіді');
        const today = todayUtc();

        deal.status = 'terminated';
        deal.terminatedBy = proposal.by;
        deal.terminatedAt = new Date();
        deal.terminationNote = proposal.note ?? '';
        deal.terminationRequest = undefined;
        deal.endDate = today > deal.startDate ? today : deal.startDate;
        await deal.save({ session });

        const car = await this.cars.findOne({ _id: deal.carId, userId: deal.ownerId }, null, { session }).exec();
        if (car && car.status === 'В оренді') {
          car.status = 'Вільне';
          car.driver = '';
          await car.save({ session });
        }
        // Прийнятий запит більше не діє: інакше орендар не зміг би знову звернутись щодо цього авто
        if (deal.source === 'request') {
          await this.rentals.updateOne(
            { _id: deal.sourceId, status: 'accepted' },
            { $set: { status: 'cancelled', decisionNote: 'Оренду розірвано за згодою сторін' } },
            { session },
          );
        }
        result = deal;
      });
    } finally {
      await session.endSession();
    }
    return this.viewFor(user, result as unknown as DealDocument);
  }

  private side(user: AuthUser) {
    return user.role === 'renter' ? { renterId: user.id } : { ownerId: user.id };
  }

  private async mine(user: AuthUser, id: string) {
    const deal = await this.deals.findOne({ _id: id, ...this.side(user) }).exec();
    if (!deal) throw new NotFoundException('Оренду не знайдено');
    return deal;
  }

  private assertOpen(deal: DealDocument) {
    if (deal.status === 'terminated') throw new ConflictException('Оренду вже розірвано');
    if (todayUtc() > deal.endDate) throw new ConflictException('Оренду вже завершено');
  }

  private async viewFor(user: AuthUser, d: DealDocument) {
    const as = user.role === 'renter' ? 'renter' : 'owner';
    return this.view(d, as, await this.people([as === 'renter' ? d.ownerId : d.renterId]));
  }

  private async people(ids: DealDocument['ownerId'][]) {
    const unique = [...new Set(ids.map(String))];
    const users = await this.users.find({ _id: { $in: unique } }, 'firstName lastName phone').lean().exec();
    return new Map<string, Person>(users.map((u) => [String(u._id), u]));
  }

  /** Контакти співрозмовника відкриті: оренда вже підтверджена обома сторонами */
  private view(d: DealDocument, as: 'renter' | 'owner', people: Map<string, Person>) {
    const p = people.get(String(as === 'renter' ? d.ownerId : d.renterId));
    const fallback = as === 'renter' ? 'Власник' : 'Орендар';
    return {
      id: String(d._id),
      title: d.title,
      photoUri: d.photoUri,
      city: d.city,
      pricePerDay: d.pricePerDay,
      startDate: d.startDate,
      endDate: d.endDate,
      source: d.source,
      status: d.status ?? 'active',
      // Пропозиція про розірвання, що чекає відповіді; `mine` — чи її подав автор запиту
      terminationRequest: d.terminationRequest ? { by: d.terminationRequest.by, at: d.terminationRequest.at, note: d.terminationRequest.note ?? '', mine: d.terminationRequest.by === as } : null,
      terminatedBy: d.terminatedBy,
      terminatedAt: d.terminatedAt,
      terminationNote: d.terminationNote ?? '',
      // Для орендаря це власник, для власника — орендар
      counterpart: { name: p ? fullName(p.firstName, p.lastName) || fallback : fallback, phone: p?.phone || undefined },
      createdAt: d.createdAt,
    };
  }
}
