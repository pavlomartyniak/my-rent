import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { type Connection, type Model, Types } from 'mongoose';

import { FINISHED_RENTAL_STATUSES, RENTAL_STATUSES, type RentalStatus } from '../common/constants';
import { acceptedMessage, requestMessage } from '../chat/auto-messages';
import { ChatService } from '../chat/chat.service';
import { newDealData } from '../deals/deal-factory';
import { dealStageOf } from '../deals/deal-stage';
import { Car } from '../schemas/car.schema';
import { Deal } from '../schemas/deal.schema';
import { Offer } from '../schemas/offer.schema';
import { RentalRequest, type RentalRequestDocument } from '../schemas/rental-request.schema';
import { User } from '../schemas/user.schema';
import type { CreateRentalDto } from './rentals.dto';
import { fullName, maskedName, rentalDays, todayUtc, totalPrice, validateRange } from './rentals.math';

const MAX_PENDING_PER_RENTER = 10;

type Person = { name: string };

@Injectable()
export class RentalsService {
  constructor(
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    @InjectConnection() private readonly connection: Connection,
    private readonly chat: ChatService,
  ) {}

  async create(renterId: string, dto: CreateRentalDto) {
    const rangeError = validateRange(dto.startDate, dto.endDate, todayUtc());
    if (rangeError) throw new BadRequestException(rangeError);

    const car = await this.cars
      .findOne({ _id: dto.carId, 'listing.published': true, status: 'Вільне' })
      .exec();
    if (!car || !car.listing) throw new NotFoundException('Оголошення більше недоступне');

    const renter = await this.users.findById(renterId).exec();
    if (!renter) throw new NotFoundException('Користувача не знайдено');
    // Профіль потрібен, щоб власник знав, кому здає авто
    if (!renter.firstName || !renter.lastName) throw new BadRequestException('Заповніть ім’я й прізвище в профілі, щоб надсилати запити');

    const open = { renterId, status: { $in: ['pending', 'accepted'] } };
    if (await this.rentals.exists({ ...open, carId: car._id })) throw new ConflictException('Ви вже надсилали запит на це авто');
    if ((await this.rentals.countDocuments({ renterId, status: 'pending' })) >= MAX_PENDING_PER_RENTER) {
      throw new ConflictException(`Одночасно можна мати до ${MAX_PENDING_PER_RENTER} запитів, що очікують відповіді`);
    }

    const created = await this.rentals.create({
      renterId,
      ownerId: car.userId,
      carId: car._id,
      startDate: dto.startDate,
      endDate: dto.endDate,
      message: dto.message ?? '',
      car: { title: `${car.brand} ${car.model} ${car.year}`, city: car.listing.city, pricePerDay: car.listing.pricePerDay, photoUri: car.photoUri },
    });
    // Одразу відкриваємо чат із власником і кидаємо в нього повідомлення, щоб вони могли зв'язатись
    const chatId = await this.chat.autoStart(
      { id: renterId, role: 'renter' },
      { rentalId: String(created._id) },
      requestMessage({ title: created.car.title, startDate: dto.startDate, endDate: dto.endDate, days: rentalDays(dto.startDate, dto.endDate), total: totalPrice(created.car.pricePerDay, dto.startDate, dto.endDate), note: dto.message }),
      `auto-${created._id}`,
    );
    return { ...this.view(created, 'renter', await this.people([car.userId])), chatId };
  }

  /** Мої запити (орендар) */
  async mine(renterId: string) {
    const items = await this.rentals.find({ renterId, hiddenFor: { $ne: 'renter' } }).sort({ createdAt: -1 }).limit(200).exec();
    const people = await this.people(items.map((r) => r.ownerId));
    const stages = await this.dealInfo(items);
    return items.map((r) => this.view(r, 'renter', people, stages.get(String(r._id))));
  }

  /** Вхідні запити (власник); `status` — необов'язковий фільтр */
  async incoming(ownerId: string, status?: string) {
    if (status && !RENTAL_STATUSES.includes(status as RentalStatus)) throw new BadRequestException('Невірний статус');
    const items = await this.rentals
      .find({ ownerId, hiddenFor: { $ne: 'owner' }, ...(status ? { status } : {}) })
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();
    const people = await this.people(items.map((r) => r.renterId));
    const stages = await this.dealInfo(items);
    return items.map((r) => this.view(r, 'owner', people, stages.get(String(r._id))));
  }

  /**
   * Прибрати скасований чи відхилений запит зі свого списку. Для другої сторони він лишається,
   * а коли його прибрали обидві сторони, запис видаляється зовсім.
   */
  async hide(user: { id: string; role: 'owner' | 'renter' }, id: string) {
    const side = user.role === 'owner' ? { ownerId: user.id } : { renterId: user.id };
    const r = await this.rentals
      .findOneAndUpdate({ _id: id, ...side, status: { $in: [...FINISHED_RENTAL_STATUSES] } }, { $addToSet: { hiddenFor: user.role } }, { returnDocument: 'after', timestamps: false })
      .exec();
    if (!r) {
      if (await this.rentals.exists({ _id: id, ...side })) throw new ConflictException('Видалити можна лише скасований, відхилений чи завершений запит');
      throw new NotFoundException('Запит не знайдено');
    }
    if (r.hiddenFor.includes('owner') && r.hiddenFor.includes('renter')) await this.rentals.deleteOne({ _id: r._id }).exec();
  }

  async cancel(renterId: string, id: string) {
    const updated = await this.rentals
      .findOneAndUpdate({ _id: id, renterId, status: 'pending' }, { $set: { status: 'cancelled', respondedAt: new Date() }, $addToSet: { hiddenFor: 'renter' } }, { returnDocument: 'after' })
      .exec();
    if (!updated) throw await this.notPending(id, { renterId });
    return this.view(updated, 'renter', await this.people([updated.ownerId]));
  }

  async decline(ownerId: string, id: string, note = '') {
    const updated = await this.rentals
      .findOneAndUpdate({ _id: id, ownerId, status: 'pending' }, { $set: { status: 'declined', decisionNote: note, respondedAt: new Date() }, $addToSet: { hiddenFor: 'owner' } }, { returnDocument: 'after' })
      .exec();
    if (!updated) throw await this.notPending(id, { ownerId });
    return this.view(updated, 'owner', await this.people([updated.renterId]));
  }

  /**
   * Прийняття запиту: авто автоматично потрапляє в облік власника (статус «В оренді», водій —
   * орендар, початок оренди — з запиту), оголошення знімається, а решта запитів на це авто відхиляється.
   */
  async accept(ownerId: string, id: string) {
    const session = await this.connection.startSession();
    let accepted: RentalRequestDocument | null = null;
    let createdDeal = '';
    try {
      await session.withTransaction(async () => {
        const request = await this.rentals.findOne({ _id: id, ownerId, status: 'pending' }, null, { session }).exec();
        if (!request) throw await this.notPending(id, { ownerId });

        const car = await this.cars.findOne({ _id: request.carId, userId: ownerId }, null, { session }).exec();
        if (!car) throw new NotFoundException('Авто не знайдено');
        if (car.status !== 'Вільне') throw new ConflictException('Авто вже не вільне: змініть статус авто, перш ніж приймати запит');

        const renter = await this.users.findById(request.renterId, null, { session }).exec();
        if (!renter) throw new NotFoundException('Орендаря не знайдено');

        const owner = await this.users.findById(ownerId, null, { session }).exec();
        if (!owner) throw new NotFoundException('Власника не знайдено');

        // Авто бронюється; «В оренді» воно стане після підписання договору й настання дати початку
        car.status = 'Заброньоване';
        car.driver = fullName(renter.firstName, renter.lastName);
        car.rentStart = request.startDate;
        if (car.listing) car.listing.published = false;
        await car.save({ session });

        request.status = 'accepted';
        request.respondedAt = new Date();
        await request.save({ session });

        await this.rentals.updateMany(
          { carId: request.carId, status: 'pending', _id: { $ne: request._id } },
          { $set: { status: 'declined', decisionNote: 'Авто вже здано іншому орендарю', respondedAt: new Date() }, $addToSet: { hiddenFor: 'owner' } },
          { session },
        );
        // Це авто вже здано: пропозиції на заявки орендарів з ним теж втрачають сенс
        await this.offers.updateMany(
          { carId: request.carId, status: 'pending' },
          { $set: { status: 'declined', decisionNote: 'Авто вже здано', respondedAt: new Date() }, $addToSet: { hiddenFor: 'owner' } },
          { session },
        );
        // Орендар отримує оренду з договором, який обидві сторони мають підписати
        const dealData = newDealData({
              owner,
              renter,
              ownerId: request.ownerId,
              renterId: request.renterId,
              carId: request.carId,
              car,
              title: request.car.title,
              photoUri: request.car.photoUri,
              city: request.car.city,
              pricePerDay: request.car.pricePerDay,
              startDate: request.startDate,
              endDate: request.endDate,
              source: 'request',
              sourceId: request._id,
        });
        await this.deals.create([dealData], { session });
        createdDeal = String(dealData._id);
        accepted = request;
      });
    } finally {
      await session.endSession();
    }
    // Повідомлення в чат: домовленість прийнято, договір сформовано
    await this.chat.autoStart({ id: ownerId, role: 'owner' }, { rentalId: String(accepted!._id) }, acceptedMessage({ startDate: accepted!.startDate }), `auto-accept-${accepted!._id}`).catch(() => null);
    // Відповідь одразу містить оренду з договором: застосунок пропонує його переглянути
    return this.view(accepted!, 'owner', await this.people([accepted!.renterId]), { dealId: createdDeal, dealStage: 'signing', contract: true });
  }

  // ---- допоміжне ----

  /** Етап оренди, що виросла з прийнятого запиту: замість «Прийнято» люди бачать «Триває», «Розірвано» тощо */
  private async dealInfo(items: RentalRequestDocument[]) {
    const ids = items.filter((r) => r.status === 'accepted' || r.status === 'ended').map((r) => r._id);
    const result = new Map<string, { dealId: string; dealStage: string; contract: boolean }>();
    if (!ids.length) return result;
    const deals = await this.deals.find({ source: 'request', sourceId: { $in: ids } }).lean().exec();
    const today = todayUtc();
    for (const d of deals) result.set(String(d.sourceId), { dealId: String(d._id), dealStage: dealStageOf(d, today), contract: !!d.contract });
    return result;
  }

  /** Чому запит не вдалось змінити: його немає чи він уже не очікує відповіді */
  private async notPending(id: string, owner: { renterId?: string; ownerId?: string }) {
    const exists = await this.rentals.exists({ _id: id, ...owner });
    return exists ? new ConflictException('Запит уже оброблено') : new NotFoundException('Запит не знайдено');
  }

  private async people(ids: Types.ObjectId[]) {
    const unique = [...new Set(ids.map(String))];
    const users = await this.users.find({ _id: { $in: unique } }, 'firstName lastName phone').lean().exec();
    return new Map(users.map((u) => [String(u._id), u]));
  }

  /**
   * Подання запиту для клієнта. Співрозмовник: для орендаря — власник, для власника — орендар.
   * Телефон показується лише після підтвердження; орендар до того бачить лише ім'я власника й ініціал.
   */
  private view(r: RentalRequestDocument, as: 'renter' | 'owner', people: Map<string, { firstName: string; lastName: string; phone: string }>, deal?: { dealId: string; dealStage: string; contract: boolean }) {
    const other = people.get(String(as === 'renter' ? r.ownerId : r.renterId));
    // Після прийняття (і після завершення оренди) відкриті повне ім'я й телефон
    const accepted = r.status === 'accepted' || r.status === 'ended';
    const counterpart: Person = other
      ? as === 'owner' || accepted
        ? { name: fullName(other.firstName, other.lastName) }
        : { name: maskedName(other.firstName, other.lastName) }
      : { name: 'Користувач видалений' };

    return {
      id: String(r._id),
      status: r.status,
      /** Оренда, що виросла з цього запиту: її етап (upcoming/active/finished/terminated) показується замість «Прийнято» */
      dealId: deal?.dealId ?? null,
      dealStage: deal?.dealStage ?? null,
      /** Чи є в оренди договір (оренди до появи договорів його не мають) */
      hasContract: deal?.contract ?? false,
      carId: String(r.carId),
      startDate: r.startDate,
      endDate: r.endDate,
      days: rentalDays(r.startDate, r.endDate),
      totalPrice: totalPrice(r.car.pricePerDay, r.startDate, r.endDate),
      message: r.message,
      decisionNote: r.decisionNote,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt ?? null,
      car: r.car,
      counterpart,
    };
  }
}
