import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

import { WANTED_STATUSES } from '../common/constants';

/** Заявка орендаря: яке авто, де й на які дати він шукає. Власники бачать її й пропонують свої авто. */
@Schema({ timestamps: true })
export class WantedRequest {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  renterId: Types.ObjectId;

  /** Необов'язкові: порожні означають «будь-яка марка / модель» */
  @Prop({ default: '' })
  brand: string;

  @Prop({ default: '' })
  model: string;

  @Prop({ required: true, trim: true })
  city: string;

  /** Нормалізоване місто для пошуку */
  @Prop({ required: true })
  cityKey: string;

  /** YYYY-MM-DD */
  @Prop({ required: true })
  startDate: string;

  @Prop({ required: true })
  endDate: string;

  /** Максимальна ціна за добу; не вказана — без обмеження */
  @Prop()
  maxPricePerDay?: number;

  /** Побажання орендаря */
  @Prop({ default: '' })
  notes: string;

  @Prop({ required: true, enum: WANTED_STATUSES, default: 'open' })
  status: string;

  createdAt: Date;
}

export type WantedRequestDocument = HydratedDocument<WantedRequest>;
export const WantedRequestSchema = SchemaFactory.createForClass(WantedRequest);
WantedRequestSchema.index({ status: 1, cityKey: 1, createdAt: -1 });
WantedRequestSchema.index({ renterId: 1, createdAt: -1 });
