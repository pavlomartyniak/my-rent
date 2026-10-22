import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

import { REMINDER_KINDS } from '../common/constants';
import { jsonOptions } from '../common/json-options';

@Schema(jsonOptions(['carId']))
export class Reminder {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Car', required: true })
  carId: Types.ObjectId;

  @Prop({ required: true, enum: REMINDER_KINDS })
  kind: string;

  /** YYYY-MM-DD */
  @Prop({ required: true })
  date: string;

  @Prop({ default: false })
  done: boolean;

  /** Ідентифікатори локальних сповіщень на пристрої користувача */
  @Prop({ type: [String], default: [] })
  notificationIds: string[];
}

export type ReminderDocument = HydratedDocument<Reminder>;
export const ReminderSchema = SchemaFactory.createForClass(Reminder);
ReminderSchema.index({ userId: 1, date: 1 });
