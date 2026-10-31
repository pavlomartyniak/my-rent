import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';

import { EXPENSE_CATEGORIES, INCOME_CATEGORY, RENTER_EXPENSE_CATEGORIES, RENTER_INCOME_CATEGORY, type Role } from '../common/constants';
import type { AuthUser } from '../common/current-user';
import { Car } from '../schemas/car.schema';
import { Deal } from '../schemas/deal.schema';
import { Transaction } from '../schemas/transaction.schema';
import { groupByMonth, monthSubtotals } from './history';
import type { CreateTransactionDto, UpdateTransactionDto } from './transactions.dto';

/** Скільки записів одного місяця віддавати за раз */
const MONTH_LIMIT = 300;

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private readonly transactions: Model<Transaction>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
  ) {}

  list(user: AuthUser, carId?: string) {
    return this.transactions
      .find({ userId: user.id, ...(carId ? { carId } : {}) })
      .sort({ date: -1, _id: -1 })
      .exec();
  }

  async get(userId: string, id: string) {
    const tx = await this.transactions.findOne({ _id: id, userId }).exec();
    if (!tx) throw new NotFoundException('Запис не знайдено');
    return tx;
  }

  /**
   * Історія авто (власник) чи оренди (орендар) частинами по місяцях, від новіших: підсумок кожного
   * місяця й записи в ньому. `months` — скільки найновіших місяців віддати; `hasMore` — чи є ще раніші.
   */
  async history(user: AuthUser, target: { carId?: string; dealId?: string }, months: number) {
    const owner = new Types.ObjectId(user.id);
    let scope: Record<string, Types.ObjectId>;
    if (user.role === 'renter') {
      if (!target.dealId) throw new BadRequestException('Вкажіть оренду');
      if (!(await this.deals.exists({ _id: target.dealId, renterId: owner }))) throw new NotFoundException('Оренду не знайдено');
      scope = { dealId: new Types.ObjectId(target.dealId) };
    } else {
      if (!target.carId) throw new BadRequestException('Вкажіть авто');
      if (!(await this.cars.exists({ _id: target.carId, userId: owner }))) throw new NotFoundException('Авто не знайдено');
      scope = { carId: new Types.ObjectId(target.carId) };
    }

    // Спершу легка агрегація по місяцях, потім записи лише вибраних місяців
    const rows = await this.transactions.aggregate<{ _id: { month: string; type: string }; sum: number }>([
      { $match: { userId: owner, ...scope } },
      { $group: { _id: { month: { $substrBytes: ['$date', 0, 7] }, type: '$type' }, sum: { $sum: '$amount' } } },
    ]);
    const all = monthSubtotals(rows.map((r) => ({ month: r._id.month, type: r._id.type, sum: r.sum })));
    const page = all.slice(0, months);
    if (!page.length) return { groups: [], hasMore: false, totalMonths: 0 };

    const items = await this.transactions
      .find({ userId: owner, ...scope, date: { $gte: `${page[page.length - 1].month}-01`, $lt: `${page[0].month}-32` } })
      .sort({ date: -1, _id: -1 })
      .exec();
    return { groups: groupByMonth(items, page), hasMore: all.length > months, totalMonths: all.length };
  }

  /**
   * Записи користувача за місяць, найновіші першими, з назвою авто. Без `carId`/`dealId` — усі записи користувача,
   * з ними — лише цього авто чи цієї оренди. Чужих записів тут не буває: вибірка завжди обмежена власником.
   */
  async month(user: AuthUser, month: string, target: { carId?: string; dealId?: string }) {
    const userId = new Types.ObjectId(user.id);
    const items = await this.transactions
      .find({
        userId,
        date: { $gte: `${month}-01`, $lte: `${month}-31` },
        ...(target.carId ? { carId: new Types.ObjectId(target.carId) } : {}),
        ...(target.dealId ? { dealId: new Types.ObjectId(target.dealId) } : {}),
      })
      .sort({ date: -1, _id: -1 })
      .limit(MONTH_LIMIT)
      .exec();
    const cars = await this.cars.find({ _id: { $in: [...new Set(items.map((t) => String(t.carId)))] } }, 'brand model').lean().exec();
    const titles = new Map(cars.map((c) => [String(c._id), `${c.brand} ${c.model}`]));
    return items.map((t) => ({ ...t.toJSON(), car: titles.get(String(t.carId)) ?? '' }));
  }

  async create(user: AuthUser, dto: CreateTransactionDto) {
    this.assertCategory(user.role, dto.type, dto.category);
    const { carId, dealId, ...rest } = dto;
    if (user.role === 'renter') {
      if (!dealId) throw new BadRequestException('Вкажіть оренду');
      const deal = await this.deals.findOne({ _id: dealId, renterId: user.id }).exec();
      if (!deal) throw new NotFoundException('Оренду не знайдено');
      if (deal.status === 'awaiting') throw new ConflictException('Договір ще не підписано обома сторонами. Записи можна вести після підписання');
      return this.transactions.create({ ...rest, userId: user.id, carId: deal.carId, dealId: deal._id });
    }
    if (!carId) throw new BadRequestException('Вкажіть авто');
    await this.assertCar(user.id, carId);
    return this.transactions.create({ ...rest, carId, userId: user.id });
  }

  async update(user: AuthUser, id: string, dto: UpdateTransactionDto) {
    const current = await this.transactions.findOne({ _id: id, userId: user.id }).exec();
    if (!current) throw new NotFoundException('Запис не знайдено');

    this.assertCategory(user.role, dto.type ?? current.type, dto.category ?? current.category);
    const { carId, dealId, ...rest } = dto;
    if (user.role === 'owner' && carId && carId !== String(current.carId)) {
      await this.assertCar(user.id, carId);
      current.carId = new Types.ObjectId(carId);
    }
    // Оренду запису змінювати не можна: він належить їй від створення
    current.set(rest);
    return current.save();
  }

  async remove(userId: string, id: string) {
    const res = await this.transactions.deleteOne({ _id: id, userId }).exec();
    if (!res.deletedCount) throw new NotFoundException('Запис не знайдено');
  }

  /** Дохід — одна категорія (власника «Оренда», орендаря «Заробіток»), витрата — з переліку ролі */
  private assertCategory(role: Role, type: string, category: string) {
    const income = role === 'renter' ? RENTER_INCOME_CATEGORY : INCOME_CATEGORY;
    const expenses: readonly string[] = role === 'renter' ? RENTER_EXPENSE_CATEGORIES : EXPENSE_CATEGORIES;
    const ok = type === 'income' ? category === income : expenses.includes(category);
    if (!ok) throw new BadRequestException('Категорія не відповідає типу запису');
  }

  private async assertCar(userId: string, carId: string) {
    if (!(await this.cars.exists({ _id: carId, userId }))) throw new NotFoundException('Авто не знайдено');
  }
}
