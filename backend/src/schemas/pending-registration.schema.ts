import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/**
 * Реєстрація, що чекає підтвердження пошти. Акаунт створюється лише після введення коду з листа, тож чужу адресу
 * зайняти не можна. Запис живе добу й видаляється сам.
 */
@Schema({ timestamps: true })
export class PendingRegistration {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, required: true })
  passwordHash: string;

  @Prop({ type: String, default: '' })
  firstName: string;

  @Prop({ type: String, default: '' })
  lastName: string;

  @Prop({ type: String, default: '' })
  phone: string;

  @Prop({ type: String, default: 'owner' })
  role: string;

  /** Посвідчення водія, вказане при реєстрації орендаря (необов'язкове) */
  @Prop({ type: Object })
  license?: { series: string; number: string; categories: string[]; validUntil: string };

  @Prop({ type: String, required: true })
  codeHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Number, default: 0 })
  attempts: number;

  @Prop({ type: Date, required: true })
  sentAt: Date;

  /** Скільки кодів надіслано за поточну годину: стеля захищає від спаму чужим поштовим скринькам */
  @Prop({ type: Number, default: 1 })
  sends: number;

  @Prop({ type: Date, required: true })
  windowStart: Date;
}

export type PendingRegistrationDocument = HydratedDocument<PendingRegistration>;
export const PendingRegistrationSchema = SchemaFactory.createForClass(PendingRegistration);
PendingRegistrationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
