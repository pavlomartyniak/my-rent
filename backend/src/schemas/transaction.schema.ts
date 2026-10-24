import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

import { TRANSACTION_TYPES } from '../common/constants';
import { jsonOptions } from '../common/json-options';

@Schema(jsonOptions(['carId']))
export class Transaction {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Car', required: true })
  carId: Types.ObjectId;

  @Prop({ required: true, enum: TRANSACTION_TYPES })
  type: string;

  @Prop({ required: true })
  amount: number;

  /** YYYY-MM-DD */
  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  category: string;

  @Prop({ default: '' })
  driver: string;

  @Prop({ default: '' })
  note: string;
}

export type TransactionDocument = HydratedDocument<Transaction>;
export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ userId: 1, carId: 1, date: -1 });
// Звіти за період: фільтр за користувачем і діапазоном дат
TransactionSchema.index({ userId: 1, date: 1 });
