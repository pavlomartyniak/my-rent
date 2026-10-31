import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';

import { PlacesService } from '../catalog/places.service';
import { escapeRegex, normalize } from '../common/normalize';
import { maskedName } from '../rentals/rentals.math';
import { Car, type CarDocument } from '../schemas/car.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { User } from '../schemas/user.schema';

export type MarketQuery = { city?: string; regionId?: number; q?: string; minPrice?: number; maxPrice?: number; maxDeposit?: number; brand?: string; model?: string; fuel?: string; page: number; limit: number };

/** Лише публічні поля: без VIN, вартості авто, водія, контактів і прізвища власника */
function publicView(car: CarDocument, ownerName: string) {
  const listing = car.listing!;
  return {
    id: String(car._id),
    brand: car.brand,
    model: car.model,
    year: car.year,
    mileage: car.mileage,
    fuel: car.fuel ?? '',
    photoUri: car.photoUri ?? null,
    // У публічній галереї лише фото, доступні за https; обкладинка завжди перша
    photos: (car.photos?.length ? car.photos : car.photoUri ? [car.photoUri] : []).filter((u) => u.startsWith('https://')),
    city: listing.city,
    pricePerDay: listing.pricePerDay,
    deposit: listing.deposit ?? 0,
    description: listing.description,
    owner: ownerName,
  };
}

@Injectable()
export class MarketService {
  constructor(
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    private readonly places: PlacesService,
  ) {}

  /** Вільні авто з опублікованими оголошеннями, найновіші першими */
  async search(query: MarketQuery, renterId?: string) {
    const filter: Record<string, unknown> = { 'listing.published': true, status: 'Вільне' };

    const cityKey = normalize(query.city ?? '');
    if (cityKey) filter['listing.cityKey'] = { $regex: escapeRegex(cityKey) };
    // Уся область: будь-яке місто з її списку
    else if (query.regionId !== undefined) filter['listing.cityKey'] = { $in: this.places.cityKeysOfRegion(query.regionId) };

    const q = (query.q ?? '').trim();
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: 'i' };
      filter['$or'] = [{ brand: rx }, { model: rx }];
    }
    // Марка й модель з каталогу: точний збіг без урахування регістру
    const brand = (query.brand ?? '').trim();
    if (brand) filter['brand'] = { $regex: `^${escapeRegex(brand)}$`, $options: 'i' };
    const model = (query.model ?? '').trim();
    if (model) filter['model'] = { $regex: `^${escapeRegex(model)}$`, $options: 'i' };
    if (query.fuel) filter['fuel'] = query.fuel;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter['listing.pricePerDay'] = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }

    // Авто без поля застави (опубліковані раніше) вважаються без застави
    if (query.maxDeposit !== undefined) filter['$and'] = [{ $or: [{ 'listing.deposit': { $lte: query.maxDeposit } }, { 'listing.deposit': { $exists: false } }] }];

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
    const requests = await this.pendingRequests(renterId, cars.map((c) => c._id));
    return {
      page: query.page,
      pages: Math.max(1, Math.ceil(total / query.limit)),
      total,
      items: cars.map((c) => ({ ...publicView(c, owners.get(String(c.userId)) ?? ''), myRequest: requests.get(String(c._id)) ?? null })),
    };
  }

  async get(id: string, renterId?: string) {
    const car = await this.cars.findOne({ _id: id, 'listing.published': true, status: 'Вільне' }).exec();
    if (!car) throw new NotFoundException('Оголошення не знайдено або вже недоступне');
    const owners = await this.owners([car.userId]);
    const requests = await this.pendingRequests(renterId, [car._id]);
    return { ...publicView(car, owners.get(String(car.userId)) ?? ''), myRequest: requests.get(String(car._id)) ?? null };
  }

  /** Мої запити на ці авто, що чекають відповіді: орендарю не дозволяємо надсилати повторний запит */
  private async pendingRequests(renterId: string | undefined, carIds: Types.ObjectId[]) {
    if (!renterId || !carIds.length) return new Map<string, { id: string; status: string }>();
    const items = await this.rentals.find({ renterId, carId: { $in: carIds }, status: 'pending' }, '_id carId status').lean().exec();
    return new Map(items.map((r) => [String(r.carId), { id: String(r._id), status: r.status }]));
  }

  private async owners(ids: Types.ObjectId[]) {
    const users = await this.users.find({ _id: { $in: [...new Set(ids.map(String))] } }, 'firstName lastName').lean().exec();
    return new Map(users.map((u) => [String(u._id), maskedName(u.firstName, u.lastName)]));
  }
}
