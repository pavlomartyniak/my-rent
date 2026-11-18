import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { ABROAD_POLICIES, ACCIDENTS, HANDOVERS, HOSTING_EXPERIENCES, INSURANCES, MILEAGE_LIMITS, REPLY_TIMES, SERVICE_CARES, DEPOSIT_READINESS, LICENSE_CATEGORIES, OCCUPATIONS, RENT_EXPERIENCES, RENT_PURPOSES, RENT_TERMS, ROLES, THEMES, TRANSMISSIONS } from '../common/constants';
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
  /** Місто користувача: показується в профілі (необов'язково) */
  @Prop({ default: '', trim: true })
  city: string;

  /** Фото профілю (https-посилання Cloudinary з папки користувача) */
  @Prop({ default: '' })
  photoUri: string;

  /** Кілька слів про себе, до 300 символів (необов'язково) */
  @Prop({ default: '', trim: true })
  about: string;

  /** З якого року водить (необов'язково): у профілі показується стаж */
  @Prop({ type: Number })
  drivingSince?: number | null;

  /** Для чого орендує авто (необов'язково) */
  @Prop({ type: [String], enum: RENT_PURPOSES, default: [] })
  purposes: string[];

  /** Категорії прав (зі слів орендаря) */
  @Prop({ type: [String], enum: LICENSE_CATEGORIES, default: [] })
  licenseCategories: string[];

  /** ДТП за останні 3 роки (зі слів); порожньо — не вказано */
  @Prop({ type: String, enum: [...ACCIDENTS, ''], default: '' })
  accidents: string;

  /** Чи орендував авто раніше */
  @Prop({ type: String, enum: [...RENT_EXPERIENCES, ''], default: '' })
  rentExperience: string;

  /** Чим займається (можна кілька) */
  @Prop({ type: [String], enum: OCCUPATIONS, default: [] })
  occupations: string[];

  /** На який строк зазвичай бере авто */
  @Prop({ type: String, enum: [...RENT_TERMS, ''], default: '' })
  rentTerm: string;

  /** Чи готовий внести заставу */
  @Prop({ type: String, enum: [...DEPOSIT_READINESS, ''], default: '' })
  depositReady: string;

  /** Яка коробка передач підходить */
  @Prop({ type: String, enum: [...TRANSMISSIONS, ''], default: '' })
  transmission: string;

  /** Як швидко відповідає (власник) */
  @Prop({ type: String, enum: [...REPLY_TIMES, ''], default: '' })
  replyTime: string;

  /** Як передає авто (власник): можна обидва способи */
  @Prop({ type: [String], enum: HANDOVERS, default: [] })
  handovers: string[];

  /** Як давно здає авто (власник) */
  @Prop({ type: String, enum: [...HOSTING_EXPERIENCES, ''], default: '' })
  hostingExperience: string;

  /** Страхування авто (власник) */
  @Prop({ type: [String], enum: INSURANCES, default: [] })
  insurances: string[];

  /** Хто обслуговує авто (власник) */
  @Prop({ type: String, enum: [...SERVICE_CARES, ''], default: '' })
  serviceCare: string;

  /** Ліміт пробігу (власник) */
  @Prop({ type: String, enum: [...MILEAGE_LIMITS, ''], default: '' })
  mileageLimit: string;

  /** Скільки км на добу входить в оренду, якщо ліміт є */
  @Prop({ type: Number })
  mileageKm?: number | null;

  /** Виїзд за кордон (власник) */
  @Prop({ type: String, enum: [...ABROAD_POLICIES, ''], default: '' })
  abroad: string;

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
