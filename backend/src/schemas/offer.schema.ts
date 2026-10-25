import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

import { FINISHED_RETENTION_SECONDS, OFFER_STATUSES } from '../common/constants';

/** Пропозиція власника на заявку орендаря: конкретне вільне авто за вказаною ціною */
@Schema({ timestamps: true })
export class Offer {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'WantedRequest', required: true, index: true })
  wantedId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  renterId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Car', required: true, index: true })
  carId: Types.ObjectId;

  @Prop({ required: true })
  pricePerDay: number;

  @Prop({ default: '' })
  message: string;

  @Prop({ required: true, enum: OFFER_STATUSES, default: 'pending' })
  status: string;

  @Prop({ default: '' })
  decisionNote: string;

  @Prop()
  respondedAt?: Date;

  /** Хто прибрав завершену пропозицію зі свого списку; коли прибрали обидва, запис видаляється */
  @Prop({ type: [String], default: [] })
  hiddenFor: string[];

  /** Дані авто на момент пропозиції: орендар бачить лише їх, а не картку авто власника */
  @Prop({
    type: { title: String, brand: String, model: String, year: Number, mileage: Number, photoUri: String, photos: [String] },
    _id: false,
    required: true,
  })
  car: { title: string; brand: string; model: string; year: number; mileage: number; photoUri?: string; photos: string[] };

  createdAt: Date;
}

export type OfferDocument = HydratedDocument<Offer>;
export const OfferSchema = SchemaFactory.createForClass(Offer);
OfferSchema.index({ ownerId: 1, createdAt: -1 });
// Відхилені, відкликані й завершені пропозиції видаляються самі через 30 днів після останньої зміни
OfferSchema.index({ updatedAt: 1 }, { expireAfterSeconds: FINISHED_RETENTION_SECONDS, partialFilterExpression: { status: { $in: ['declined', 'withdrawn', 'ended'] } } });
