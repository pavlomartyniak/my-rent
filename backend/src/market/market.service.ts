import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';

import { escapeRegex, normalize } from '../common/normalize';
import { maskedName } from '../rentals/rentals.math';
import { Car, type CarDocument } from '../schemas/car.schema';
import { User } from '../schemas/user.schema';

export type MarketQuery = { city?: string; q?: string; minPrice?: number; maxPrice?: number; page: number; limit: number };

/** Лише публічні поля: без VIN, вартості авто, водія, контактів і прізвища власника */
function publicView(car: CarDocument, ownerName: string) {
  const listing = car.listing!;
  return {
    id: String(car._id),
    brand: car.brand,
    model: car.model,
    year: car.year,
    mileage: car.mileage,
    photoUri: car.photoUri ?? null,
    city: listing.city,
    pricePerDay: listing.pricePerDay,
    description: listing.description,
    owner: ownerName,
  };
}

@Injectable()
export class MarketService {
  constructor(
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  /** Вільні авто з опублікованими оголошеннями, найновіші першими */
  async search(query: MarketQuery) {
    const filter: Record<string, unknown> = { 'listing.published': true, status: 'Вільне' };

    const cityKey = normalize(query.city ?? '');
    if (cityKey) filter['listing.cityKey'] = { $regex: escapeRegex(cityKey) };

    const q = (query.q ?? '').trim();
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: 'i' };
      filter['$or'] = [{ brand: rx }, { model: rx }];
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter['listing.pricePerDay'] = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }

    const [total, cars] = await Promise.all([
      this.cars.countDocuments(filter),
      this.cars
        .find(filter)
        .sort({ 'listing.publishedAt': -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
    ]);
    const owners = await this.owners(cars.map((c) => c.userId));
    return {
      page: query.page,
      pages: Math.max(1, Math.ceil(total / query.limit)),
      total,
      items: cars.map((c) => publicView(c, owners.get(String(c.userId)) ?? '')),
    };
  }

  async get(id: string) {
    const car = await this.cars.findOne({ _id: id, 'listing.published': true, status: 'Вільне' }).exec();
    if (!car) throw new NotFoundException('Оголошення не знайдено або вже недоступне');
    const owners = await this.owners([car.userId]);
    return publicView(car, owners.get(String(car.userId)) ?? '');
  }

  private async owners(ids: Types.ObjectId[]) {
    const users = await this.users.find({ _id: { $in: [...new Set(ids.map(String))] } }, 'firstName lastName').lean().exec();
    return new Map(users.map((u) => [String(u._id), maskedName(u.firstName, u.lastName)]));
  }
}
