import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { MAX_LISTINGS } from '../common/constants';
import { badField } from '../common/field-errors';
import { type CarLegal, normalizeCarLegal, plateValid } from '../common/car-plate';
import { normalize } from '../common/normalize';
import { MediaService } from '../media/media.service';
import { Car } from '../schemas/car.schema';
import { Deal } from '../schemas/deal.schema';
import { Reminder } from '../schemas/reminder.schema';
import { Offer } from '../schemas/offer.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { Transaction } from '../schemas/transaction.schema';
import type { CreateCarDto, ListingDto, UpdateCarDto } from './cars.dto';
import { freeSlot, listingAccess, releaseListingSlot } from './listing-access';
import { normalizePhotos } from './photos';

/** Усі місця для публікації зайняті іншими авто (ліміт бета-версії). Клієнт за кодом показує пояснення */
const listingLimit = () =>
  new HttpException(
    { statusCode: HttpStatus.FORBIDDEN, error: 'Forbidden', code: 'LISTING_LIMIT', limit: MAX_LISTINGS, message: `Можна опублікувати до ${MAX_LISTINGS} авто одночасно. Зніміть з публікації одне з опублікованих, щоб опублікувати це` },
    HttpStatus.FORBIDDEN,
  );

/** Державний номер зберігаємо в єдиному вигляді: великі літери, без пробілів і дефісів */
function withCarLegal<T extends Partial<CarLegal>>(dto: T): T {
  const out = { ...dto };
  for (const k of ['plate', 'color'] as const) {
    if (dto[k] !== undefined) out[k] = normalizeCarLegal({ [k]: dto[k] })[k] as T[typeof k];
  }
  return out;
}

@Injectable()
export class CarsService {
  constructor(
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Transaction.name) private readonly transactions: Model<Transaction>,
    @InjectModel(Reminder.name) private readonly reminders: Model<Reminder>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    private readonly media: MediaService,
  ) {}

  list(userId: string) {
    return this.cars.find({ userId }).sort({ _id: 1 }).exec();
  }

  async create(userId: string, dto: CreateCarDto) {
    // Державний номер обов'язковий із самого початку: без нього авто не можна ні опублікувати, ні вказати в договорі
    if (!plateValid(dto.plate)) throw badField('plate', 'Вкажіть державний номер авто (наприклад AA1234BB)');
    // Облік без ліміту: у бета-версії обмежена лише кількість опублікованих авто
    return this.cars.create({ ...normalizePhotos(withCarLegal(dto)), userId });
  }

  async get(userId: string, id: string) {
    const car = await this.cars.findOne({ _id: id, userId }).exec();
    if (!car) throw new NotFoundException('Авто не знайдено');
    return car;
  }

  async update(userId: string, id: string, dto: UpdateCarDto) {
    if (dto.plate !== undefined && !plateValid(dto.plate)) throw badField('plate', 'Вкажіть державний номер авто (наприклад AA1234BB)');
    // Фото до зміни: те, чого в новому наборі немає, прибираємо з Cloudinary
    const before = await this.cars.findOne({ _id: id, userId }, 'photoUri photos').lean().exec();
    const car = await this.cars.findOneAndUpdate({ _id: id, userId }, { $set: normalizePhotos(withCarLegal(dto)) }, { new: true, runValidators: true }).exec();
    if (!car) throw new NotFoundException('Авто не знайдено');
    if (before) {
      const kept = new Set([car.photoUri, ...(car.photos ?? [])]);
      void this.media.release([before.photoUri, ...(before.photos ?? [])].filter((u) => u && !kept.has(u)));
    }

    // Авто, яке вже не вільне, не може лишатись в оголошеннях
    if (dto.status && dto.status !== 'Вільне' && car.listing?.published) {
      car.listing.published = false;
      releaseListingSlot(car);
      await car.save();
    }
    return car;
  }

  /** Публікує оголошення (або оновлює його): авто має бути вільним і мати фото, доступне іншим користувачам */
  async publish(userId: string, id: string, dto: ListingDto) {
    const car = await this.get(userId, id);
    if (car.moderationHidden) throw new ForbiddenException('Оголошення приховано модератором після скарги. Напишіть на kolo.rentapp@gmail.com');
    if (car.status !== 'Вільне') throw new BadRequestException('Опублікувати можна лише авто зі статусом «Вільне»');
    if (!car.photoUri?.startsWith('https://')) {
      throw new BadRequestException('Для оголошення потрібне фото авто, завантажене на сервер. Додайте його в редагуванні авто.');
    }
    const cityKey = normalize(dto.city);
    if (!cityKey) throw new BadRequestException('Вкажіть місто');

    // Публікація цього авто вже відкрита, або воно займає вільне місце, або місць (MAX_LISTINGS) уже немає
    const used = car.listingUnlock ? 0 : await this.cars.countDocuments({ userId, listingUnlock: 'free', _id: { $ne: car._id } });
    const access = listingAccess(car.listingUnlock, used, MAX_LISTINGS);
    if (access === 'limit') throw listingLimit();
    if (access === 'free') {
      const taken = (await this.cars.find({ userId, listingFreeSlot: { $exists: true } }, 'listingFreeSlot').lean().exec()).map((c) => c.listingFreeSlot!);
      const slot = freeSlot(taken, MAX_LISTINGS);
      if (slot === null) throw listingLimit();
      car.listingUnlock = 'free';
      car.listingFreeSlot = slot;
      car.listingUnlockedAt = new Date();
    }

    car.listing = {
      published: true,
      city: dto.city,
      cityKey,
      pricePerDay: dto.pricePerDay,
      deposit: Math.round(dto.deposit ?? 0),
      description: dto.description ?? '',
      publishedAt: car.listing?.published ? car.listing.publishedAt : new Date(),
    };
    try {
      return await car.save();
    } catch (e) {
      // Унікальний індекс: інший запит у цей же момент зайняв те саме місце
      if (access === 'free' && (e as { code?: number }).code === 11000) throw new ConflictException('Не вдалося зайняти місце для публікації. Спробуйте ще раз');
      throw e;
    }
  }

  /** Знімає оголошення з публікації й звільняє місце; дані оголошення зберігаються для повторної публікації */
  async unpublish(userId: string, id: string) {
    const car = await this.get(userId, id);
    if (car.listing) {
      car.listing.published = false;
      await car.save();
    }
    return car;
  }

  /** Видаляє авто разом з його записами й нагадуваннями */
  async remove(userId: string, id: string) {
    // Авто, яке зараз здане орендарю, видаляти не можна: спершу розірвіть оренду
    const today = new Date().toISOString().slice(0, 10);
    if (await this.deals.exists({ ownerId: userId, carId: id, status: { $ne: 'terminated' }, endDate: { $gte: today } })) {
      throw new ConflictException('Авто зараз в оренді. Спершу розірвіть оренду (картка авто → «Зараз в оренді»)');
    }
    const car = await this.cars.findOneAndDelete({ _id: id, userId }).exec();
    if (!car) throw new NotFoundException('Авто не знайдено');
    await Promise.all([
      this.transactions.deleteMany({ userId, carId: id }),
      this.reminders.deleteMany({ userId, carId: id }),
      this.rentals.deleteMany({ carId: id }),
      this.offers.deleteMany({ carId: id }),
    ]);
    // Фото авто більше нікому не потрібні, якщо на них не лишилось посилань в оренд, запитах і чатах
    void this.media.release([car.photoUri, ...(car.photos ?? [])]);
  }
}
