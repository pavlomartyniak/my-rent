import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { INCOME_CATEGORY } from '../common/constants';
import { Car } from '../schemas/car.schema';
import { Transaction } from '../schemas/transaction.schema';
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
