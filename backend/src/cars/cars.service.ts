import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { FREE_CAR_LIMIT, PRO_CAR_LIMIT } from '../common/constants';
import { Car } from '../schemas/car.schema';
import { Reminder } from '../schemas/reminder.schema';
import { Transaction } from '../schemas/transaction.schema';
import { UsersService } from '../users/users.service';
import type { CreateCarDto, UpdateCarDto } from './cars.dto';

@Injectable()
export class CarsService {
  constructor(
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Transaction.name) private readonly transactions: Model<Transaction>,
    @InjectModel(Reminder.name) private readonly reminders: Model<Reminder>,
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
    return this.cars.create({ ...dto, userId });
  }

  async get(userId: string, id: string) {
    const car = await this.cars.findOne({ _id: id, userId }).exec();
    if (!car) throw new NotFoundException('Авто не знайдено');
    return car;
  }

  async update(userId: string, id: string, dto: UpdateCarDto) {
    const car = await this.cars.findOneAndUpdate({ _id: id, userId }, { $set: dto }, { new: true, runValidators: true }).exec();
    if (!car) throw new NotFoundException('Авто не знайдено');
    return car;
  }

  /** Видаляє авто разом з його записами й нагадуваннями */
  async remove(userId: string, id: string) {
    const car = await this.cars.findOneAndDelete({ _id: id, userId }).exec();
    if (!car) throw new NotFoundException('Авто не знайдено');
    await Promise.all([this.transactions.deleteMany({ userId, carId: id }), this.reminders.deleteMany({ userId, carId: id })]);
  }
}
