import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';

import type { AuthUser } from '../common/current-user';
import { fullName, todayUtc } from '../rentals/rentals.math';
import { Car } from '../schemas/car.schema';
import { Transaction } from '../schemas/transaction.schema';
import { Offer } from '../schemas/offer.schema';
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
    @InjectModel(Transaction.name) private readonly transactions: Model<Transaction>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /** Усі оренди орендаря, новіші першими */
  async list(renterId: string) {
    const items = await this.deals.find({ renterId, hiddenFor: { $ne: 'renter' } }).sort({ createdAt: -1 }).limit(200).exec();
    const people = await this.people(items.map((d) => d.ownerId));
    return items.map((d) => this.view(d, 'renter', people));
  }

  async get(renterId: string, id: string) {
    const deal = await this.deals.findOne({ _id: id, renterId, hiddenFor: { $ne: 'renter' } }).exec();
    if (!deal) throw new NotFoundException('Оренду не знайдено');
    return this.view(deal, 'renter', await this.people([deal.ownerId]));
  }

  /** Завершені чи розірвані оренди авто власника (архів) */
  async archiveForCar(ownerId: string, carId: string) {
    const items = await this.deals
      .find({ ownerId, carId, hiddenFor: { $ne: 'owner' }, $or: [{ status: 'terminated' }, { endDate: { $lt: todayUtc() } }] })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
    const people = await this.people(items.map((d) => d.renterId));
    return items.map((d) => this.view(d, 'owner', people));
  }

  /**
   * Видалити архівну (завершену чи розірвану) оренду зі свого списку. Для орендаря разом з нею видаляються
   * його записи й аналітика по ній. Для другої сторони оренда лишається, а коли прибрали обидві, запис видаляється.
   */
  async hide(user: AuthUser, id: string) {
    const archived = { $or: [{ status: 'terminated' }, { endDate: { $lt: todayUtc() } }] };
    const deal = await this.deals
      .findOneAndUpdate({ _id: id, ...this.side(user), ...archived }, { $addToSet: { hiddenFor: user.role } }, { returnDocument: 'after', timestamps: false })
      .exec();
    if (!deal) {
      if (await this.deals.exists({ _id: id, ...this.side(user) })) throw new ConflictException('Видалити можна лише завершену чи розірвану оренду');
      throw new NotFoundException('Оренду не знайдено');
    }
    if (user.role === 'renter') await this.transactions.deleteMany({ userId: user.id, dealId: deal._id }).exec();
    if (deal.hiddenFor.includes('owner') && deal.hiddenFor.includes('renter')) await this.deals.deleteOne({ _id: deal._id }).exec();
  }

  /**
   * Оренди, що закінчились за датою, а авто в обліку власника досі «В оренді»: застосунок пропонує його звільнити.
   * Автоматично це не робиться, бо власник міг продовжити оренду без застосунку.
   */
  async awaitingRelease(ownerId: string) {
    const today = todayUtc();
    const ended = await this.deals
      .find({ ownerId, status: { $ne: 'terminated' }, endDate: { $lt: today }, releaseDismissed: { $ne: true } })
      .sort({ endDate: -1 })
      .limit(50)
      .exec();
    if (!ended.length) return [];
    const carIds = [...new Set(ended.map((d) => String(d.carId)))];
    const [cars, running] = await Promise.all([
      this.cars.find({ _id: { $in: carIds }, userId: ownerId, status: 'В оренді' }, '_id').lean().exec(),
      // Якщо на це авто вже є інша діюча оренда, підказувати нічого
      this.deals.find({ ownerId, carId: { $in: carIds }, status: { $ne: 'terminated' }, endDate: { $gte: today } }, 'carId').lean().exec(),
    ]);
    const rented = new Set(cars.map((c) => String(c._id)));
    const busy = new Set(running.map((d) => String(d.carId)));
    const seen = new Set<string>();
    const items = ended.filter((d) => {
      const car = String(d.carId);
      if (!rented.has(car) || busy.has(car) || seen.has(car)) return false;
      seen.add(car);
      return true;
    });
    const people = await this.people(items.map((d) => d.renterId));
    return items.map((d) => this.view(d, 'owner', people));
  }

  /** Власник підтверджує: оренда закінчилась, авто знову вільне */
  async release(ownerId: string, id: string) {
    const deal = await this.deals.findOne({ _id: id, ownerId }).exec();
    if (!deal) throw new NotFoundException('Оренду не знайдено');
    if (deal.status !== 'terminated' && todayUtc() <= deal.endDate) throw new ConflictException('Оренда ще триває');
    const car = await this.cars.findOne({ _id: deal.carId, userId: ownerId }).exec();
    if (car && car.status === 'В оренді') {
      car.status = 'Вільне';
      car.driver = '';
      await car.save();
    }
  }

  /** «Оренда триває»: більше не питати про цю оренду */
  async keepRented(ownerId: string, id: string) {
    const res = await this.deals.updateOne({ _id: id, ownerId }, { $set: { releaseDismissed: true } }, { timestamps: false }).exec();
    if (!res.matchedCount) throw new NotFoundException('Оренду не знайдено');
  }

  /** Оренди, де друга сторона запропонувала розірвати угоду й чекає моєї відповіді */
  async awaitingMyAnswer(user: AuthUser) {
    const other = user.role === 'renter' ? 'owner' : 'renter';
    const items = await this.deals
      .find({ ...this.side(user), status: { $ne: 'terminated' }, endDate: { $gte: todayUtc() }, 'terminationRequest.by': other })
      .sort({ 'terminationRequest.at': -1 })
      .limit(50)
      .exec();
    const as = user.role === 'renter' ? 'renter' : 'owner';
    const people = await this.people(items.map((d) => (as === 'renter' ? d.ownerId : d.renterId)));
    return items.map((d) => this.view(d, as, people));
  }

  /** Поточна оренда авто власника (діє чи ще не почалась); null — авто не здано через застосунок */
  async activeForCar(ownerId: string, carId: string) {
    const deal = await this.deals.findOne({ ownerId, carId, hiddenFor: { $ne: 'owner' }, status: { $ne: 'terminated' }, endDate: { $gte: todayUtc() } }).sort({ createdAt: -1 }).exec();
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
        // Прийнятий запит чи пропозиція завершується разом з орендою: інакше вони б «висіли» як прийняті,
        // а орендар не зміг би знову звернутись щодо цього авто
        const ended = { $set: { status: 'ended', decisionNote: 'Оренду розірвано за згодою сторін', respondedAt: new Date() } };
        if (deal.source === 'request') await this.rentals.updateOne({ _id: deal.sourceId, status: 'accepted' }, ended, { session });
        else await this.offers.updateOne({ _id: deal.sourceId, status: 'accepted' }, ended, { session });
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
      carId: String(d.carId),
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
