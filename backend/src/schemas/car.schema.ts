import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

import { CAR_STATUSES } from '../common/constants';
import { jsonOptions } from '../common/json-options';

/** Оголошення про оренду, видиме орендарям, поки published=true і авто вільне */
@Schema({ _id: false })
export class CarListing {
  @Prop({ default: false })
  published: boolean;

  @Prop({ required: true, trim: true })
  city: string;

  /** Нормалізоване місто для пошуку (без регістру й діакритики) */
  @Prop({ required: true })
  cityKey: string;

  @Prop({ required: true })
  pricePerDay: number;

  @Prop({ default: '' })
  description: string;

  @Prop()
  publishedAt?: Date;
}
export const CarListingSchema = SchemaFactory.createForClass(CarListing);

@Schema(jsonOptions())
export class Car {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  brand: string;

  @Prop({ required: true, trim: true })
  model: string;

  @Prop({ required: true })
  year: number;

  @Prop({ default: '' })
  vin: string;

  @Prop({ default: 0 })
  mileage: number;

  /** YYYY-MM-DD */
  @Prop({ required: true })
  rentStart: string;

  /** Вартість авто — база для ROI */
  @Prop({ required: true })
  price: number;

  @Prop({ required: true, enum: CAR_STATUSES, default: CAR_STATUSES[0] })
  status: string;

  @Prop({ default: '' })
  driver: string;

  /** Локальний URI фото на пристрої; завантаження файлів на сервер поки не реалізоване */
  @Prop()
  photoUri?: string;

  /** Усі фото авто; перше з них — обкладинка (дублюється в photoUri) */
  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ type: CarListingSchema })
  listing?: CarListing;
}

export type CarDocument = HydratedDocument<Car>;
export const CarSchema = SchemaFactory.createForClass(Car);
// Пошук оголошень: опубліковані вільні авто за містом, найновіші першими
CarSchema.index({ 'listing.published': 1, status: 1, 'listing.cityKey': 1, 'listing.publishedAt': -1 });
