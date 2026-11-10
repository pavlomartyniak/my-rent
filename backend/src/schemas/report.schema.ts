import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

import { REPORT_KINDS, REPORT_REASONS, REPORT_STATUSES } from '../moderation/moderation.constants';

/** Скарга на оголошення, користувача чи повідомлення. Модератор розглядає її скриптом `npm run moderate` */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Report {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  reporterId: Types.ObjectId;

  @Prop({ type: String, enum: REPORT_KINDS, required: true })
  kind: string;

  /** На кого скарга: власник оголошення, співрозмовник чи автор повідомлення */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  targetUserId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Car' })
  carId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Message' })
  messageId?: Types.ObjectId;

  @Prop({ type: String, enum: REPORT_REASONS, required: true })
  reason: string;

  @Prop({ type: String, default: '' })
  note: string;

  /** Знімок того, на що поскаржились (назва авто чи текст повідомлення): доказ зберігається, навіть якщо автор його видалить */
  @Prop({ type: String, default: '' })
  snapshot: string;

  @Prop({ type: String, enum: REPORT_STATUSES, default: 'open' })
  status: string;

  @Prop({ type: String, default: '' })
  resolution: string;

  @Prop({ type: Date })
  resolvedAt?: Date;

  createdAt: Date;
}

export type ReportDocument = HydratedDocument<Report>;
export const ReportSchema = SchemaFactory.createForClass(Report);
ReportSchema.index({ status: 1, createdAt: -1 });
