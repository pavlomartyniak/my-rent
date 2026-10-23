import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { THEMES } from '../common/constants';
import { jsonOptions } from '../common/json-options';

@Schema(jsonOptions([], ['passwordHash']))
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  /** Профіль. Порожні рядки — у акаунтів, створених до появи цих полів */
  @Prop({ default: '', trim: true })
  firstName: string;

  @Prop({ default: '', trim: true })
  lastName: string;

  @Prop({ default: '', trim: true })
  phone: string;

  @Prop({ default: false })
  isPro: boolean;

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
