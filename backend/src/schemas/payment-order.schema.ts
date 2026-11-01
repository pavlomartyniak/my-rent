import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, type Types } from 'mongoose';

export const PAYMENT_STATUSES = ['created', 'paid', 'failed', 'reversed'] as const;

/**
 * Замовлення на оплату публікації одного авто. Створюється, коли власник платить за авто понад безкоштовні місця;
 * у WayForPay воно має номер `_id`, а публікацію відкриває лише підтверджений вебхук.
 */
@Schema({ timestamps: true })
export class PaymentOrder {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Car', required: true })
  carId: Types.ObjectId;

  /** Сума в гривнях */
  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, default: 'UAH' })
  currency: string;

  @Prop({ required: true, enum: PAYMENT_STATUSES, default: 'created' })
  status: string;

  /** Сторінка оплати WayForPay; номером замовлення в платіжній системі є `_id` */
  @Prop()
  pageUrl?: string;

  @Prop()
  failureReason?: string;

  @Prop()
  paidAt?: Date;

  createdAt: Date;
}

export type PaymentOrderDocument = HydratedDocument<PaymentOrder>;
export const PaymentOrderSchema = SchemaFactory.createForClass(PaymentOrder);
PaymentOrderSchema.index({ userId: 1, carId: 1, status: 1 });
