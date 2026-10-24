import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { Deal, type DealDocument } from '../schemas/deal.schema';
import { User } from '../schemas/user.schema';
import { fullName } from '../rentals/rentals.math';

@Injectable()
export class DealsService {
  constructor(
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  /** Усі оренди орендаря, новіші першими */
  async list(renterId: string) {
    const items = await this.deals.find({ renterId }).sort({ createdAt: -1 }).limit(200).exec();
    const owners = await this.owners(items);
    return items.map((d) => this.view(d, owners));
  }

  async get(renterId: string, id: string) {
    const deal = await this.deals.findOne({ _id: id, renterId }).exec();
    if (!deal) throw new NotFoundException('Оренду не знайдено');
    return this.view(deal, await this.owners([deal]));
  }

  private async owners(items: DealDocument[]) {
    const ids = [...new Set(items.map((d) => String(d.ownerId)))];
    const users = await this.users.find({ _id: { $in: ids } }, 'firstName lastName phone').lean().exec();
    return new Map(users.map((u) => [String(u._id), u]));
  }

  /** Контакти власника відкриті: угода вже підтверджена обома сторонами */
  private view(d: DealDocument, owners: Map<string, { firstName: string; lastName: string; phone: string }>) {
    const o = owners.get(String(d.ownerId));
    return {
      id: String(d._id),
      title: d.title,
      photoUri: d.photoUri,
      city: d.city,
      pricePerDay: d.pricePerDay,
      startDate: d.startDate,
      endDate: d.endDate,
      source: d.source,
      owner: { name: o ? fullName(o.firstName, o.lastName) || 'Власник' : 'Власник', phone: o?.phone || undefined },
      createdAt: d.createdAt,
    };
  }
}
