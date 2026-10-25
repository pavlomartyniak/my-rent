import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { Car } from '../schemas/car.schema';
import { Reminder } from '../schemas/reminder.schema';
import { Conversation } from '../schemas/conversation.schema';
import { Deal } from '../schemas/deal.schema';
import { Message } from '../schemas/message.schema';
import { Offer } from '../schemas/offer.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { Transaction } from '../schemas/transaction.schema';
import { User } from '../schemas/user.schema';
import { WantedRequest } from '../schemas/wanted-request.schema';

@Injectable()
export class DataService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Transaction.name) private readonly transactions: Model<Transaction>,
    @InjectModel(Reminder.name) private readonly reminders: Model<Reminder>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectModel(WantedRequest.name) private readonly wanted: Model<WantedRequest>,
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    @InjectModel(Conversation.name) private readonly conversations: Model<Conversation>,
    @InjectModel(Message.name) private readonly messages: Model<Message>,
  ) {}

  /** Профіль, авто й нагадування одним запитом — для старту застосунку */
  async all(userId: string) {
    // Записи не віддаємо: їх може бути тисячі, тож клієнти беруть їх частинами через /transactions/history
    const [user, cars, reminders] = await Promise.all([
      this.users.findById(userId).exec(),
      this.cars.find({ userId }).sort({ _id: 1 }).exec(),
      this.reminders.find({ userId }).sort({ date: 1, _id: 1 }).exec(),
    ]);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return { user, cars, reminders };
  }

  /** Видаляє авто, записи й нагадування; акаунт залишається */
  async clear(userId: string, session?: ClientSession) {
    await this.cars.deleteMany({ userId }, { session });
    await this.transactions.deleteMany({ userId }, { session });
    await this.reminders.deleteMany({ userId }, { session });
    // Запити на оренду авто, які щойно видалили
    await this.rentals.deleteMany({ ownerId: userId }, { session });
    await this.offers.deleteMany({ ownerId: userId }, { session });
  }

  async deleteAccount(userId: string) {
    await this.clear(userId);
    await this.rentals.deleteMany({ $or: [{ renterId: userId }, { ownerId: userId }] });
    // Заявки орендаря разом із пропозиціями на них; пропозиції власника
    const mine = await this.wanted.find({ renterId: userId }, '_id').lean().exec();
    await this.offers.deleteMany({ $or: [{ ownerId: userId }, { renterId: userId }, { wantedId: { $in: mine.map((w) => w._id) } }] });
    await this.wanted.deleteMany({ renterId: userId });
    // Оренди орендаря (його записи вже видалено в clear)
    await this.deals.deleteMany({ renterId: userId });
    // Чати з усією перепискою: співрозмовник теж їх більше не побачить
    const chats = await this.conversations.find({ $or: [{ ownerId: userId }, { renterId: userId }] }, '_id').lean().exec();
    await this.messages.deleteMany({ conversationId: { $in: chats.map((c) => c._id) } });
    await this.conversations.deleteMany({ _id: { $in: chats.map((c) => c._id) } });
    await this.users.deleteOne({ _id: userId });
  }
}
