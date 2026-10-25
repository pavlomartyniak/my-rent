import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

import { FINISHED_RETENTION_SECONDS, RENTAL_STATUSES } from '../common/constants';

/** Запит орендаря на оренду авто. Дані авто копіюються на момент запиту, щоб запит лишався зрозумілим, якщо оголошення змінять. */
@Schema({ timestamps: true })
export class RentalRequest {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  renterId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Car', required: true, index: true })
  carId: Types.ObjectId;

  /** YYYY-MM-DD */
  @Prop({ required: true })
  startDate: string;

  @Prop({ required: true })
  endDate: string;

  @Prop({ default: '' })
  message: string;

  @Prop({ required: true, enum: RENTAL_STATUSES, default: 'pending' })
  status: string;

  /** Коментар власника при відмові або причина автоматичного відхилення */
  @Prop({ default: '' })
  decisionNote: string;

  @Prop()
  respondedAt?: Date;

  /** Хто прибрав завершений запит зі свого списку; коли прибрали обидва, запис видаляється */
  @Prop({ type: [String], default: [] })
  hiddenFor: string[];

  @Prop({
    type: { title: String, city: String, pricePerDay: Number, photoUri: String },
    _id: false,
    required: true,
  })
  car: { title: string; city: string; pricePerDay: number; photoUri?: string };

  createdAt: Date;
}

export type RentalRequestDocument = HydratedDocument<RentalRequest>;
export const RentalRequestSchema = SchemaFactory.createForClass(RentalRequest);
RentalRequestSchema.index({ renterId: 1, createdAt: -1 });
// Скасовані, відхилені й завершені запити видаляються самі через 30 днів після останньої зміни
RentalRequestSchema.index({ updatedAt: 1 }, { expireAfterSeconds: FINISHED_RETENTION_SECONDS, partialFilterExpression: { status: { $in: ['cancelled', 'declined', 'ended'] } } });
RentalRequestSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
