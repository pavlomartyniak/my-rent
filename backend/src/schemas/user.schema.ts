import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { ROLES, THEMES } from '../common/constants';
import { jsonOptions } from '../common/json-options';

@Schema(jsonOptions([], ['passwordHash', 'resetCodeHash', 'resetExpires', 'resetAttempts', 'suspended', 'phoneKey']))
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  /** Акаунт призупинено модератором: вхід і запити закриті, оголошення приховані */
  @Prop({ type: Boolean, default: false })
  suspended: boolean;

  /** Код відновлення пароля (хеш), строк дії й кількість невдалих спроб */
  @Prop()
  resetCodeHash?: string;

  @Prop()
  resetExpires?: Date;

  @Prop({ default: 0 })
  resetAttempts: number;

  /** Профіль. Порожні рядки — у акаунтів, створених до появи цих полів */
  @Prop({ default: '', trim: true })
  firstName: string;

  @Prop({ default: '', trim: true })
  lastName: string;

  /** По батькові: обов'язкове при реєстрації, потрапляє в договір (ПІБ повністю) */
  @Prop({ default: '', trim: true })
  middleName: string;

  @Prop({ default: '', trim: true })
  phone: string;

  /** Нормалізований номер для перевірки унікальності; у старих акаунтів без телефону відсутній */
  @Prop({ type: String })
  phoneKey?: string;

  /** Тип акаунта: owner — власник авто (облік), renter — орендар (пошук і запити); не змінюється */
  @Prop({ enum: ROLES, default: 'owner' })
  role: string;

  @Prop({ default: false })
  onboarded: boolean;

  @Prop({ type: [String], default: [] })
  dismissedHints: string[];

  /** Тема оформлення: system — як у телефоні */
  @Prop({ enum: THEMES, default: 'system' })
  theme: string;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
// Один номер — один акаунт; акаунти без номера (створені до цього правила) в індекс не потрапляють
UserSchema.index({ phoneKey: 1 }, { unique: true, partialFilterExpression: { phoneKey: { $type: 'string' } } });
