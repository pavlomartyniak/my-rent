import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { type Connection, type Model, Types } from 'mongoose';

import { fullName, maskedName, rentalDays, todayUtc, totalPrice } from '../rentals/rentals.math';
import { Car } from '../schemas/car.schema';
import { Deal } from '../schemas/deal.schema';
import { Offer, type OfferDocument } from '../schemas/offer.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { User } from '../schemas/user.schema';
import { WantedRequest, type WantedRequestDocument } from '../schemas/wanted-request.schema';
import { wantedView } from '../wanted/wanted.service';
import type { CreateOfferDto } from './offers.dto';

const MAX_PENDING_PER_WANTED = 30;

type Person = { firstName: string; lastName: string; phone: string };

@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectModel(WantedRequest.name) private readonly wanted: Model<WantedRequest>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /** Власник пропонує своє вільне авто на заявку орендаря */
  async create(ownerId: string, wantedId: string, dto: CreateOfferDto) {
    const w = await this.wanted.findOne({ _id: wantedId, status: 'open', endDate: { $gte: todayUtc() } }).exec();
    if (!w) throw new NotFoundException('Заявка вже закрита або недоступна');

    const car = await this.cars.findOne({ _id: dto.carId, userId: ownerId, status: 'Вільне' }).exec();
    if (!car) throw new NotFoundException('Авто не знайдено або воно не вільне');

    if (await this.offers.exists({ wantedId: w._id, carId: car._id, status: { $in: ['pending', 'accepted'] } })) {
      throw new ConflictException('Ви вже запропонували це авто на цю заявку');
    }
    if ((await this.offers.countDocuments({ wantedId: w._id, status: 'pending' })) >= MAX_PENDING_PER_WANTED) {
      throw new ConflictException('На цю заявку вже забагато пропозицій');
    }
    const owner = await this.users.findById(ownerId).exec();
    if (!owner?.firstName || !owner.lastName) throw new BadRequestException('Заповніть ім’я й прізвище в профілі, щоб робити пропозиції');

    const created = await this.offers.create({
      wantedId: w._id,
      renterId: w.renterId,
      ownerId,
      carId: car._id,
      pricePerDay: dto.pricePerDay,
      message: dto.message ?? '',
      car: {
        title: `${car.brand} ${car.model} ${car.year}`,
        brand: car.brand,
        model: car.model,
        year: car.year,
        mileage: car.mileage,
        photoUri: car.photoUri,
        photos: (car.photos ?? []).filter((u) => u.startsWith('https://')),
      },
    });
    return this.view(created, 'owner', w, await this.people([w.renterId]));
  }

  /** Пропозиції на мою заявку (орендар) */
  async forWanted(renterId: string, wantedId: string) {
    const w = await this.wanted.findOne({ _id: wantedId, renterId }).exec();
    if (!w) throw new NotFoundException('Заявку не знайдено');
    const items = await this.offers.find({ wantedId: w._id, status: { $ne: 'withdrawn' } }).sort({ createdAt: -1 }).exec();
    const people = await this.people(items.map((o) => o.ownerId));
    return {
      wanted: wantedView(w),
      offers: items.map((o) => this.view(o, 'renter', w, people)),
    };
  }

  /** Мої пропозиції (власник) */
  async mine(ownerId: string) {
    const items = await this.offers.find({ ownerId }).sort({ createdAt: -1 }).limit(200).exec();
    const wanted = await this.wanted.find({ _id: { $in: items.map((o) => o.wantedId) } }).exec();
    const byId = new Map(wanted.map((w) => [String(w._id), w]));
    const people = await this.people(items.map((o) => o.renterId));
    return items.flatMap((o) => {
      const w = byId.get(String(o.wantedId));
      return w ? [this.view(o, 'owner', w, people)] : [];
    });
  }

  async withdraw(ownerId: string, id: string) {
    const o = await this.offers.findOneAndUpdate({ _id: id, ownerId, status: 'pending' }, { $set: { status: 'withdrawn', respondedAt: new Date() } }, { returnDocument: 'after' }).exec();
    if (!o) throw await this.notPending(id, { ownerId });
    return { id: String(o._id), status: o.status };
  }

  async decline(renterId: string, id: string, note = '') {
    const o = await this.offers
      .findOneAndUpdate({ _id: id, renterId, status: 'pending' }, { $set: { status: 'declined', decisionNote: note, respondedAt: new Date() } }, { returnDocument: 'after' })
      .exec();
    if (!o) throw await this.notPending(id, { renterId });
    return { id: String(o._id), status: o.status };
  }

  /**
   * Орендар приймає пропозицію: авто автоматично потрапляє в облік власника (статус «В оренді»,
   * водій — орендар, початок — з заявки), оголошення знімається, заявка виконана, а всі інші пропозиції
   * й запити на це авто відхиляються. Усе в одній транзакції.
   */
  async accept(renterId: string, id: string) {
    const session = await this.connection.startSession();
    let accepted: OfferDocument | null = null;
    let wantedDoc: WantedRequestDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const offer = await this.offers.findOne({ _id: id, renterId, status: 'pending' }, null, { session }).exec();
        if (!offer) throw await this.notPending(id, { renterId });

        const w = await this.wanted.findOne({ _id: offer.wantedId, renterId, status: 'open' }, null, { session }).exec();
        if (!w) throw new ConflictException('Заявку вже закрито');

        const car = await this.cars.findOne({ _id: offer.carId, userId: offer.ownerId }, null, { session }).exec();
        if (!car) throw new NotFoundException('Авто більше не існує');
        if (car.status !== 'Вільне') throw new ConflictException('Власник уже здав або зняв це авто');

        const renter = await this.users.findById(renterId, null, { session }).exec();
        if (!renter) throw new NotFoundException('Користувача не знайдено');

        car.status = 'В оренді';
        car.driver = fullName(renter.firstName, renter.lastName);
        car.rentStart = w.startDate;
        if (car.listing) car.listing.published = false;
        await car.save({ session });

        offer.status = 'accepted';
        offer.respondedAt = new Date();
        await offer.save({ session });

        w.status = 'fulfilled';
        await w.save({ session });

        const now = new Date();
        await this.offers.updateMany(
          { wantedId: w._id, status: 'pending', _id: { $ne: offer._id } },
          { $set: { status: 'declined', decisionNote: 'Орендар обрав іншу пропозицію', respondedAt: now } },
          { session },
        );
        // Це саме авто більше не вільне: відхиляємо й інші пропозиції та запити з ним
        await this.offers.updateMany(
          { carId: car._id, status: 'pending', _id: { $ne: offer._id } },
          { $set: { status: 'declined', decisionNote: 'Авто вже здано', respondedAt: now } },
          { session },
        );
        await this.rentals.updateMany(
          { carId: car._id, status: 'pending' },
          { $set: { status: 'declined', decisionNote: 'Авто вже здано іншому орендарю', respondedAt: now } },
          { session },
        );
        await this.deals.create(
          [
            {
              renterId: offer.renterId,
              ownerId: offer.ownerId,
              carId: offer.carId,
              title: offer.car.title,
              photoUri: offer.car.photoUri,
              city: w.city,
              pricePerDay: offer.pricePerDay,
              startDate: w.startDate,
              endDate: w.endDate,
              source: 'offer',
              sourceId: offer._id,
            },
          ],
          { session },
        );
        accepted = offer;
        wantedDoc = w;
      });
    } finally {
      await session.endSession();
    }
    return this.view(accepted!, 'renter', wantedDoc!, await this.people([accepted!.ownerId]));
  }

  // ---- допоміжне ----

  private async notPending(id: string, owner: { renterId?: string; ownerId?: string }) {
    return (await this.offers.exists({ _id: id, ...owner })) ? new ConflictException('Пропозицію вже оброблено') : new NotFoundException('Пропозицію не знайдено');
  }

  private async people(ids: Types.ObjectId[]) {
    const unique = [...new Set(ids.map(String))];
    const users = await this.users.find({ _id: { $in: unique } }, 'firstName lastName phone').lean().exec();
    return new Map<string, Person>(users.map((u) => [String(u._id), u]));
  }

  /**
   * Подання пропозиції. Співрозмовник: для орендаря — власник, для власника — орендар.
   * До прийняття обидва бачать лише ім'я з ініціалом; повне ім'я й телефон — після прийняття.
   */
  private view(o: OfferDocument, as: 'renter' | 'owner', w: { startDate: string; endDate: string; city: string; brand: string; model: string; status: string; _id: Types.ObjectId }, people: Map<string, Person>) {
    const other = people.get(String(as === 'renter' ? o.ownerId : o.renterId));
    const accepted = o.status === 'accepted';
    const counterpart = other
      ? accepted
        ? { name: fullName(other.firstName, other.lastName), ...(other.phone ? { phone: other.phone } : {}) }
        : { name: maskedName(other.firstName, other.lastName) }
      : { name: 'Користувач видалений' };

    return {
      id: String(o._id),
      status: o.status,
      wantedId: String(w._id),
      carId: String(o.carId),
      pricePerDay: o.pricePerDay,
      days: rentalDays(w.startDate, w.endDate),
      totalPrice: totalPrice(o.pricePerDay, w.startDate, w.endDate),
      message: o.message,
      decisionNote: o.decisionNote,
      createdAt: o.createdAt,
      car: o.car,
      counterpart,
      wanted: { city: w.city, brand: w.brand, model: w.model, startDate: w.startDate, endDate: w.endDate, status: w.status },
    };
  }
}
