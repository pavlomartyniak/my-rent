import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, type PipelineStage, Types } from 'mongoose';

import { Car } from '../schemas/car.schema';
import { Transaction } from '../schemas/transaction.schema';
import {
  bestWorst,
  categoryShares,
  currentMonth,
  fillSeries,
  margin,
  overviewOf,
  parsePeriod,
  pctChange,
  previousPeriod,
  seriesMonths,
  totalsOf,
  type ParsedPeriod,
} from './reports.math';

type TypeSum = { _id: string; sum: number };
type MonthRow = { _id: { month: string; type: string }; sum: number };
type CarRow = { _id: { carId: Types.ObjectId; type: string }; sum: number; first: string };

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Transaction.name) private readonly txs: Model<Transaction>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
  ) {}

  /** Загальний звіт за місяць або рік: підсумки, порівняння з минулим періодом, графік, витрати, показники по кожному авто */
  async summary(userId: string, periodKey?: string) {
    const period = this.period(periodKey);
    const owner = new Types.ObjectId(userId);
    const previousKey = previousPeriod(period);
    const previous = parsePeriod(previousKey)!;

    const [now, before, series, categories, perCar, allCars, cars] = await Promise.all([
      this.totals(owner, period),
      this.totals(owner, previous),
      this.series(owner, period),
      this.categories(owner, period),
      this.byCar(owner, period),
      this.byCar(owner),
      this.cars.find({ userId: owner }).sort({ _id: 1 }).exec(),
    ]);

    return {
      period: period.key,
      previousPeriod: previousKey,
      totals: { ...now, margin: margin(now) },
      previous: { ...before, margin: margin(before) },
      change: {
        profit: pctChange(now.profit, before.profit),
        income: pctChange(now.income, before.income),
        expense: pctChange(now.expense, before.expense),
        // Маржа порівнюється в процентних пунктах, а не у відсотках від відсотків
        marginPoints: margin(now) !== null && margin(before) !== null ? Math.round((margin(now)! - margin(before)!) * 10) / 10 : null,
      },
      series,
      categories,
      cars: cars.map((car) => {
        const id = String(car._id);
        const p = perCar.get(id);
        const a = allCars.get(id);
        return {
          carId: id,
          period: totalsOf(p?.income ?? 0, p?.expense ?? 0),
          overview: overviewOf({ price: car.price, income: a?.income ?? 0, expense: a?.expense ?? 0, rentStart: car.rentStart, firstRecord: a?.first }),
        };
      }),
    };
  }

  /** Детальний звіт по одному авто: період, графік, витрати, показники за весь час, по роках, найкращий і найгірший місяць */
  async car(userId: string, carId: string, periodKey?: string) {
    const owner = new Types.ObjectId(userId);
    const car = await this.cars.findOne({ _id: carId, userId: owner }).exec();
    if (!car) throw new NotFoundException('Авто не знайдено');

    const period = this.period(periodKey);
    const carFilter = { carId: car._id };

    const [now, series, categories, allCategories, all, months] = await Promise.all([
      this.totals(owner, period, carFilter),
      this.series(owner, period, carFilter),
      this.categories(owner, period, carFilter),
      this.categories(owner, undefined, carFilter),
      this.byCar(owner, undefined, carFilter),
      this.monthRows(owner, undefined, carFilter),
    ]);

    const a = all.get(String(car._id));
    const monthly = [...new Set(months.map((r) => r._id.month))].map((month) => {
      const sum = (type: string) => months.filter((r) => r._id.month === month && r._id.type === type).reduce((s, r) => s + r.sum, 0);
      return { month, profit: totalsOf(sum('income'), sum('expense')).profit };
    });
    const years = [...new Set(monthly.map((m) => m.month.slice(0, 4)))].sort().reverse().map((year) => {
      const rows = months.filter((r) => r._id.month.startsWith(year));
      const sum = (type: string) => rows.filter((r) => r._id.type === type).reduce((s, r) => s + r.sum, 0);
      return { year, ...totalsOf(sum('income'), sum('expense')) };
    });

    return {
      carId: String(car._id),
      period: period.key,
      totals: { ...now, margin: margin(now) },
      series,
      categories,
      allCategories,
      overview: overviewOf({ price: car.price, income: a?.income ?? 0, expense: a?.expense ?? 0, rentStart: car.rentStart, firstRecord: a?.first }),
      years,
      ...bestWorst(monthly),
    };
  }

  // ---- агрегації ----

  private period(key?: string): ParsedPeriod {
    const parsed = parsePeriod(key ?? currentMonth());
    if (!parsed) throw new BadRequestException('Невірний період: очікується РРРР-ММ або РРРР');
    return parsed;
  }

  /** Фільтр записів користувача; дати — рядки ISO, тому порівняння діапазоном використовує індекс */
  private match(owner: Types.ObjectId, period?: Pick<ParsedPeriod, 'from' | 'to'>, extra: Record<string, unknown> = {}): PipelineStage.Match {
    return { $match: { userId: owner, ...extra, ...(period ? { date: { $gte: period.from, $lt: period.to } } : {}) } };
  }

  private async totals(owner: Types.ObjectId, period: ParsedPeriod, extra?: Record<string, unknown>) {
    const rows = await this.txs.aggregate<TypeSum>([this.match(owner, period, extra), { $group: { _id: '$type', sum: { $sum: '$amount' } } }]);
    const sum = (type: string) => rows.find((r) => r._id === type)?.sum ?? 0;
    return totalsOf(sum('income'), sum('expense'));
  }

  private monthRows(owner: Types.ObjectId, period?: Pick<ParsedPeriod, 'from' | 'to'>, extra?: Record<string, unknown>) {
    return this.txs.aggregate<MonthRow>([
      this.match(owner, period, extra),
      { $group: { _id: { month: { $substrBytes: ['$date', 0, 7] }, type: '$type' }, sum: { $sum: '$amount' } } },
    ]);
  }

  private async series(owner: Types.ObjectId, period: ParsedPeriod, extra?: Record<string, unknown>) {
    const months = seriesMonths(period);
    const range = { from: `${months[0]}-01`, to: `${months[months.length - 1]}-32` };
    const rows = await this.monthRows(owner, range, extra);
    return fillSeries(months, rows.map((r) => ({ month: r._id.month, type: r._id.type, sum: r.sum })));
  }

  private async categories(owner: Types.ObjectId, period?: ParsedPeriod, extra?: Record<string, unknown>) {
    const rows = await this.txs.aggregate<{ _id: string; sum: number }>([
      this.match(owner, period, { ...extra, type: 'expense' }),
      { $group: { _id: '$category', sum: { $sum: '$amount' } } },
    ]);
    return categoryShares(rows.map((r) => ({ category: r._id, sum: r.sum })));
  }

  /** Доходи, витрати й дата першого запису по кожному авто (за період або за весь час) */
  private async byCar(owner: Types.ObjectId, period?: ParsedPeriod, extra?: Record<string, unknown>) {
    const rows = await this.txs.aggregate<CarRow>([
      this.match(owner, period, extra),
      { $group: { _id: { carId: '$carId', type: '$type' }, sum: { $sum: '$amount' }, first: { $min: '$date' } } },
    ]);
    const result = new Map<string, { income: number; expense: number; first?: string }>();
    for (const r of rows) {
      const id = String(r._id.carId);
      const entry = result.get(id) ?? { income: 0, expense: 0 };
      entry[r._id.type === 'income' ? 'income' : 'expense'] += r.sum;
      entry.first = entry.first && entry.first < r.first ? entry.first : r.first;
      result.set(id, entry);
    }
    return result;
  }
}
