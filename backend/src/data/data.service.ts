import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { Car } from '../schemas/car.schema';
import { Reminder } from '../schemas/reminder.schema';
import { Transaction } from '../schemas/transaction.schema';
import { User } from '../schemas/user.schema';

@Injectable()
export class DataService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Transaction.name) private readonly transactions: Model<Transaction>,
    @InjectModel(Reminder.name) private readonly reminders: Model<Reminder>,
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

  /** Видаляє авто, записи й нагадування; акаунт залишається */
  async clear(userId: string, session?: ClientSession) {
    await this.cars.deleteMany({ userId }, { session });
    await this.transactions.deleteMany({ userId }, { session });
    await this.reminders.deleteMany({ userId }, { session });
  }

  async deleteAccount(userId: string) {
    await this.clear(userId);
    await this.users.deleteOne({ _id: userId });
  }
}
