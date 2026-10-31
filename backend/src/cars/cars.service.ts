import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { FREE_LISTINGS, LISTING_PRICE_USD } from '../common/constants';
import { normalize } from '../common/normalize';
import { Car } from '../schemas/car.schema';
import { Deal } from '../schemas/deal.schema';
import { Reminder } from '../schemas/reminder.schema';
import { Offer } from '../schemas/offer.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { Transaction } from '../schemas/transaction.schema';
import type { CreateCarDto, ListingDto, UpdateCarDto } from './cars.dto';
import { freeSlot, listingAccess } from './listing-access';
import { normalizePhotos } from './photos';

/** Публікація цього авто ще не відкрита: безкоштовні місця вже зайняті іншими авто. Клієнт за кодом показує оплату */
const paymentRequired = () =>
  new HttpException(
    { statusCode: HttpStatus.PAYMENT_REQUIRED, error: 'Payment Required', code: 'LISTING_PAYMENT_REQUIRED', price: LISTING_PRICE_USD, message: `Перші ${FREE_LISTINGS} авто публікуються безкоштовно, кожне наступне коштує ${LISTING_PRICE_USD} $ разово. Сплатіть публікацію цього авто, щоб продовжити` },
    HttpStatus.PAYMENT_REQUIRED,
  );

@Injectable()
export class CarsService {
  constructor(
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Transaction.name) private readonly transactions: Model<Transaction>,
    @InjectModel(Reminder.name) private readonly reminders: Model<Reminder>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
  ) {}

  list(userId: string) {
    return this.cars.find({ userId }).sort({ _id: 1 }).exec();
  }

  async create(userId: string, dto: CreateCarDto) {
    // Облік безкоштовний і без ліміту: платна лише публікація кожного наступного авто
    return this.cars.create({ ...normalizePhotos(dto), userId });
  }

  async get(userId: string, id: string) {
    const car = await this.cars.findOne({ _id: id, userId }).exec();
    if (!car) throw new NotFoundException('Авто не знайдено');
    return car;
  }

  async update(userId: string, id: string, dto: UpdateCarDto) {
    const car = await this.cars.findOneAndUpdate({ _id: id, userId }, { $set: normalizePhotos(dto) }, { new: true, runValidators: true }).exec();
    if (!car) throw new NotFoundException('Авто не знайдено');

    // Авто, яке вже не вільне, не може лишатись в оголошеннях
    if (dto.status && dto.status !== 'Вільне' && car.listing?.published) {
      car.listing.published = false;
      await car.save();
    }
    return car;
  }

  /** Публікує оголошення (або оновлює його): авто має бути вільним і мати фото, доступне іншим користувачам */
  async publish(userId: string, id: string, dto: ListingDto) {
    const car = await this.get(userId, id);
    if (car.status !== 'Вільне') throw new BadRequestException('Опублікувати можна лише авто зі статусом «Вільне»');
    if (!car.photoUri?.startsWith('https://')) {
      throw new BadRequestException('Для оголошення потрібне фото авто, завантажене на сервер. Додайте його в редагуванні авто.');
    }
    const cityKey = normalize(dto.city);
    if (!cityKey) throw new BadRequestException('Вкажіть місто');

    // Публікація вже відкрита (безкоштовно чи оплатою), або авто займає вільне безкоштовне місце, або потрібна оплата
    const freeUsed = car.listingUnlock ? 0 : await this.cars.countDocuments({ userId, listingUnlock: 'free', _id: { $ne: car._id } });
    const access = listingAccess(car.listingUnlock, freeUsed, FREE_LISTINGS);
    if (access === 'payment') throw paymentRequired();
    if (access === 'free') {
      const taken = (await this.cars.find({ userId, listingFreeSlot: { $exists: true } }, 'listingFreeSlot').lean().exec()).map((c) => c.listingFreeSlot!);
      const slot = freeSlot(taken, FREE_LISTINGS);
      if (slot === null) throw paymentRequired();
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
      // Унікальний індекс: інший запит у цей же момент зайняв те саме безкоштовне місце
      if (access === 'free' && (e as { code?: number }).code === 11000) throw new ConflictException('Не вдалося зайняти безкоштовне місце. Спробуйте ще раз');
      throw e;
    }
  }

  /**
   * Відкриває публікацію цього авто разовою оплатою. Поки оплата не підключена, працює лише в демо-режимі (перевіряє
   * контролер). Повторний виклик для вже відкритого авто нічого не змінює.
   */
  async unlockListing(userId: string, id: string) {
    const car = await this.get(userId, id);
    if (car.listingUnlock) return car;
    car.listingUnlock = 'paid';
    car.listingUnlockedAt = new Date();
    return car.save();
  }

  /** Знімає оголошення з публікації; дані оголошення зберігаються для повторної публікації */
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
  }
}
