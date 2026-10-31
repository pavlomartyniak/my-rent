import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { ROLES, THEMES } from '../common/constants';
import { jsonOptions } from '../common/json-options';

@Schema(jsonOptions([], ['passwordHash', 'resetCodeHash', 'resetExpires', 'resetAttempts']))
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

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

  @Prop({ default: '', trim: true })
  phone: string;

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
