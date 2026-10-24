import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';

import { INCOME_CATEGORY } from '../common/constants';
import { Car } from '../schemas/car.schema';
import { Transaction } from '../schemas/transaction.schema';
import { groupByMonth, monthSubtotals } from './history';
import type { CreateTransactionDto, UpdateTransactionDto } from './transactions.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private readonly transactions: Model<Transaction>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
  ) {}

  list(userId: string, carId?: string) {
    return this.transactions
      .find({ userId, ...(carId ? { carId } : {}) })
      .sort({ date: -1, _id: -1 })
      .exec();
  }

  async get(userId: string, id: string) {
    const tx = await this.transactions.findOne({ _id: id, userId }).exec();
    if (!tx) throw new NotFoundException('Запис не знайдено');
    return tx;
  }

  /**
   * Історія авто частинами по місяцях, від новіших: підсумок кожного місяця й записи в ньому.
   * `months` — скільки найновіших місяців віддати; `hasMore` каже, чи є ще раніші.
   */
  async history(userId: string, carId: string, months: number) {
    const owner = new Types.ObjectId(userId);
    if (!(await this.cars.exists({ _id: carId, userId: owner }))) throw new NotFoundException('Авто не знайдено');
    const car = new Types.ObjectId(carId);

    // Спершу легка агрегація по місяцях, потім записи лише вибраних місяців
    const rows = await this.transactions.aggregate<{ _id: { month: string; type: string }; sum: number }>([
      { $match: { userId: owner, carId: car } },
      { $group: { _id: { month: { $substrBytes: ['$date', 0, 7] }, type: '$type' }, sum: { $sum: '$amount' } } },
    ]);
    const all = monthSubtotals(rows.map((r) => ({ month: r._id.month, type: r._id.type, sum: r.sum })));
    const page = all.slice(0, months);
    if (!page.length) return { groups: [], hasMore: false, totalMonths: 0 };

    const items = await this.transactions
      .find({ userId: owner, carId: car, date: { $gte: `${page[page.length - 1].month}-01`, $lt: `${page[0].month}-32` } })
      .sort({ date: -1, _id: -1 })
      .exec();
    return { groups: groupByMonth(items, page), hasMore: all.length > months, totalMonths: all.length };
  }

  async create(userId: string, dto: CreateTransactionDto) {
    this.assertCategory(dto.type, dto.category);
    await this.assertCar(userId, dto.carId);
    return this.transactions.create({ ...dto, userId });
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const current = await this.transactions.findOne({ _id: id, userId }).exec();
    if (!current) throw new NotFoundException('Запис не знайдено');

    this.assertCategory(dto.type ?? current.type, dto.category ?? current.category);
    if (dto.carId && dto.carId !== String(current.carId)) await this.assertCar(userId, dto.carId);

    current.set(dto);
    return current.save();
  }

  async remove(userId: string, id: string) {
    const res = await this.transactions.deleteOne({ _id: id, userId }).exec();
    if (!res.deletedCount) throw new NotFoundException('Запис не знайдено');
  }

  /** Дохід — лише «Оренда», витрата — одна з категорій витрат */
  private assertCategory(type: string, category: string) {
    if ((type === 'income') !== (category === INCOME_CATEGORY)) {
      throw new BadRequestException('Категорія не відповідає типу запису');
    }
  }

  private async assertCar(userId: string, carId: string) {
    if (!(await this.cars.exists({ _id: carId, userId }))) throw new NotFoundException('Авто не знайдено');
  }
}
