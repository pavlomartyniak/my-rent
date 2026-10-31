import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';

import type { AuthUser } from '../common/current-user';
import { parsePeriod } from '../reports/reports.math';
import { Car } from '../schemas/car.schema';
import { Deal } from '../schemas/deal.schema';
import { Transaction } from '../schemas/transaction.schema';
import { toCsv } from './csv';
import { renderExportPdf } from './export.pdf';
import { type ExportData, TYPE_LABEL } from './export.types';
import { renderXlsx } from './export.xlsx';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type ExportFilter = { carId?: string; dealId?: string; period?: string };

const CONTENT_TYPE: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

const periodTitle = (key: string) => {
  if (key === 'all') return 'весь час';
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  return m ? `${m[2]}.${m[1]}` : `${key} рік`;
};

@Injectable()
export class ExportService {
  constructor(
    @InjectModel(Transaction.name) private readonly txs: Model<Transaction>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
  ) {}

  /** Файл із доходами й витратами: власник — по своїх авто, орендар — по своїх орендах; за потреби звужено авто/орендою й періодом */
  async file(user: AuthUser, format: ExportFormat, filter: ExportFilter) {
    const data = await this.collect(user, filter);
    const body =
      format === 'csv'
        ? toCsv(
            ['Дата', 'Авто', 'Тип', 'Категорія', 'Сума', 'Водій', 'Примітка'],
            data.rows.map((r) => [r.date, r.car, TYPE_LABEL[r.type], r.category, r.amount, r.driver, r.note]),
          )
        : format === 'xlsx'
          ? await renderXlsx(data)
          : await renderExportPdf(data);
    return { body, contentType: CONTENT_TYPE[format], filename: `${data.name}.${format}` };
  }

  private async collect(user: AuthUser, opts: ExportFilter): Promise<ExportData> {
    const me = new Types.ObjectId(user.id);
    const filter: Record<string, unknown> = { userId: me };
    let name = 'kolo';
    let subtitle = user.role === 'owner' ? 'Усі авто' : 'Усі оренди';

    if (opts.carId && user.role === 'owner') {
      const car = await this.cars.findOne({ _id: opts.carId, userId: me }).exec();
      if (!car) throw new NotFoundException('Авто не знайдено');
      filter.carId = car._id;
      name += `-${car.brand}-${car.model}`.replace(/[^\p{L}\p{N}]+/gu, '-');
      subtitle = `${car.brand} ${car.model}`;
    }
    if (opts.dealId && user.role === 'renter') {
      const deal = await this.deals.findOne({ _id: opts.dealId, renterId: me }).exec();
      if (!deal) throw new NotFoundException('Оренду не знайдено');
      filter.dealId = deal._id;
      const car = await this.cars.findById(deal.carId).exec();
      name += car ? `-${car.brand}-${car.model}`.replace(/[^\p{L}\p{N}]+/gu, '-') : '-orenda';
      subtitle = car ? `${car.brand} ${car.model}` : 'Оренда';
    }
    if (opts.period) {
      const period = parsePeriod(opts.period);
      if (!period) throw new BadRequestException('Невірний період: очікується РРРР-ММ, РРРР або all');
      filter.date = { $gte: period.from, $lt: period.to };
      name += `-${period.key}`;
      subtitle += ` · ${periodTitle(period.key)}`;
    } else {
      subtitle += ' · увесь час';
    }

    const txs = await this.txs.find(filter).sort({ date: 1, _id: 1 }).lean().exec();
    // Авто орендаря належать власникам, тож шукаємо за id із записів, а не за власником
    const cars = await this.cars.find({ _id: { $in: [...new Set(txs.map((t) => String(t.carId)))] } }).lean().exec();
    const carName = new Map(cars.map((c) => [String(c._id), `${c.brand} ${c.model}`]));

    return {
      name,
      title: user.role === 'owner' ? 'Звіт: доходи та витрати' : 'Звіт орендаря: доходи та витрати',
      subtitle,
      rows: txs.map((t) => ({
        date: t.date,
        car: carName.get(String(t.carId)) ?? '',
        type: t.type === 'income' ? 'income' : 'expense',
        category: t.category,
        amount: t.amount,
        driver: t.driver,
        note: t.note,
      })),
    };
  }
}
