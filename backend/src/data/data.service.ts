import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { type ClientSession, type Connection, type Model, Types } from 'mongoose';

import { Car } from '../schemas/car.schema';
import { Reminder } from '../schemas/reminder.schema';
import { Transaction } from '../schemas/transaction.schema';
import { User } from '../schemas/user.schema';
import type { ImportDto } from './data.dto';

@Injectable()
export class DataService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Transaction.name) private readonly transactions: Model<Transaction>,
    @InjectModel(Reminder.name) private readonly reminders: Model<Reminder>,
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
  ) {}

  /** Усі дані користувача одним запитом — для старту застосунку */
  async all(userId: string) {
    const [user, cars, transactions, reminders] = await Promise.all([
      this.users.findById(userId).exec(),
      this.cars.find({ userId }).sort({ _id: 1 }).exec(),
      this.transactions.find({ userId }).sort({ date: -1, _id: -1 }).exec(),
      this.reminders.find({ userId }).sort({ date: 1, _id: 1 }).exec(),
    ]);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return { user, cars, transactions, reminders };
  }

  /** Повністю замінює дані користувача (демо-дані). Лише в демо-режимі. */
  async replaceAll(userId: string, dto: ImportDto) {
    if (this.config.get('DEMO_MODE') !== 'true') throw new ForbiddenException('Імпорт даних вимкнено');

    const owner = new Types.ObjectId(userId);
    const carIds = new Map<string, Types.ObjectId>();
    const cars = dto.cars.map(({ id, ...car }) => {
      const _id = new Types.ObjectId();
      carIds.set(id, _id);
      return { ...car, _id, userId: owner };
    });
    // Записи й нагадування з невідомим авто відкидаємо
    const transactions = dto.transactions.flatMap((t) =>
      carIds.has(t.carId) ? [{ ...t, carId: carIds.get(t.carId), userId: owner }] : [],
    );
    const reminders = dto.reminders.flatMap((r) =>
      carIds.has(r.carId) ? [{ ...r, carId: carIds.get(r.carId), userId: owner }] : [],
    );

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        await this.clear(userId, session);
        if (cars.length) await this.cars.insertMany(cars, { session });
        if (transactions.length) await this.transactions.insertMany(transactions, { session });
        if (reminders.length) await this.reminders.insertMany(reminders, { session });
      });
    } finally {
      await session.endSession();
    }
    return this.all(userId);
  }

  /** Видаляє авто, записи й нагадування; акаунт залишається */
  async clear(userId: string, session?: ClientSession) {
    // Послідовно: у межах однієї транзакції MongoDB не допускає паралельних операцій
    await this.cars.deleteMany({ userId }, { session });
    await this.transactions.deleteMany({ userId }, { session });
    await this.reminders.deleteMany({ userId }, { session });
  }

  async deleteAccount(userId: string) {
    await this.clear(userId);
    await this.users.deleteOne({ _id: userId });
  }
}
