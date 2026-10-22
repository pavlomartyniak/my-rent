import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { jsonOptions } from '../common/json-options';

@Schema(jsonOptions([], ['passwordHash']))
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ default: false })
  isPro: boolean;

  @Prop({ default: false })
  onboarded: boolean;

  @Prop({ type: [String], default: [] })
  dismissedHints: string[];
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
