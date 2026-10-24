import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';

import { parsePeriod } from '../reports/reports.math';
import { Car } from '../schemas/car.schema';
import { Transaction } from '../schemas/transaction.schema';
import { toCsv } from './csv';

@Injectable()
export class ExportService {
  constructor(
    @InjectModel(Transaction.name) private readonly txs: Model<Transaction>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
  ) {}

  /** Доходи й витрати у CSV; за потреби — лише одного авто й/або за період (місяць чи рік) */
  async transactions(userId: string, opts: { carId?: string; period?: string }) {
    const owner = new Types.ObjectId(userId);
    const filter: Record<string, unknown> = { userId: owner };
    let name = 'my-rent';

    if (opts.carId) {
      const car = await this.cars.findOne({ _id: opts.carId, userId: owner }).exec();
      if (!car) throw new NotFoundException('Авто не знайдено');
      filter.carId = car._id;
      name += `-${car.brand}-${car.model}`.replace(/[^\p{L}\p{N}]+/gu, '-');
    }
    if (opts.period) {
      const period = parsePeriod(opts.period);
      if (!period) throw new BadRequestException('Невірний період: очікується РРРР-ММ або РРРР');
      filter.date = { $gte: period.from, $lt: period.to };
      name += `-${period.key}`;
    }

    const [txs, cars] = await Promise.all([
      this.txs.find(filter).sort({ date: 1, _id: 1 }).lean().exec(),
      this.cars.find({ userId: owner }).lean().exec(),
    ]);
    const carName = new Map(cars.map((c) => [String(c._id), `${c.brand} ${c.model}`]));

    const csv = toCsv(
      ['Дата', 'Авто', 'Тип', 'Категорія', 'Сума', 'Водій', 'Примітка'],
      txs.map((t) => [t.date, carName.get(String(t.carId)) ?? '', t.type === 'income' ? 'Дохід' : 'Витрата', t.category, t.amount, t.driver, t.note]),
    );
    return { csv, filename: `${name}.csv` };
  }
}
