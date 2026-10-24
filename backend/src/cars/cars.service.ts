import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { FREE_CAR_LIMIT, PRO_CAR_LIMIT } from '../common/constants';
import { normalize } from '../common/normalize';
import { Car } from '../schemas/car.schema';
import { Reminder } from '../schemas/reminder.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { Transaction } from '../schemas/transaction.schema';
import { UsersService } from '../users/users.service';
import type { CreateCarDto, ListingDto, UpdateCarDto } from './cars.dto';
import { normalizePhotos } from './photos';

@Injectable()
export class CarsService {
  constructor(
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Transaction.name) private readonly transactions: Model<Transaction>,
    @InjectModel(Reminder.name) private readonly reminders: Model<Reminder>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    private readonly users: UsersService,
  ) {}

  list(userId: string) {
    return this.cars.find({ userId }).sort({ _id: 1 }).exec();
  }

  async create(userId: string, dto: CreateCarDto) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Користувача не знайдено');

    const limit = user.isPro ? PRO_CAR_LIMIT : FREE_CAR_LIMIT;
    if ((await this.cars.countDocuments({ userId })) >= limit) {
      throw new ForbiddenException(`Ліміт тарифу: ${limit} авто. Перейдіть на Pro, щоб додати більше.`);
    }
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

    car.listing = {
      published: true,
      city: dto.city,
      cityKey,
      pricePerDay: dto.pricePerDay,
      description: dto.description ?? '',
      publishedAt: car.listing?.published ? car.listing.publishedAt : new Date(),
    };
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
    const car = await this.cars.findOneAndDelete({ _id: id, userId }).exec();
    if (!car) throw new NotFoundException('Авто не знайдено');
    await Promise.all([
      this.transactions.deleteMany({ userId, carId: id }),
      this.reminders.deleteMany({ userId, carId: id }),
      this.rentals.deleteMany({ carId: id }),
    ]);
  }
}
