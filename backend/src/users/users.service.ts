import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictException } from '@nestjs/common';
import type { LegalProfile } from '../common/legal';
import { PHONE_TAKEN, phoneKey } from '../common/profile';
import { User, type UserDocument } from '../schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  findByEmail(email: string) {
    return this.users.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  /** Зберегти код відновлення пароля (хеш) і строк його дії */
  setReset(id: string, codeHash: string, expires: Date) {
    return this.users.updateOne({ _id: id }, { $set: { resetCodeHash: codeHash, resetExpires: expires, resetAttempts: 0 } }).exec();
  }

  /** Невдала спроба: рахуємо її, а після ліміту анулюємо код */
  failReset(id: string, burn: boolean) {
    return this.users.updateOne({ _id: id }, burn ? { $unset: { resetCodeHash: 1, resetExpires: 1 }, $set: { resetAttempts: 0 } } : { $inc: { resetAttempts: 1 } }).exec();
  }

  /** Новий пароль; код і лічильник очищаються */
  finishReset(id: string, passwordHash: string) {
    return this.users.updateOne({ _id: id }, { $set: { passwordHash, resetAttempts: 0 }, $unset: { resetCodeHash: 1, resetExpires: 1 } }).exec();
  }

  findById(id: string) {
    return this.users.findById(id).exec();
  }

  /** Чи зайнятий номер іншим акаунтом (exceptId — власний акаунт, який не рахується) */
  async phoneTaken(phone: string, exceptId?: string) {
    const key = phoneKey(phone);
    if (!key) return false;
    const filter: Record<string, unknown> = { phoneKey: key };
    if (exceptId) filter._id = { $ne: exceptId };
    return !!(await this.users.exists(filter));
  }

  async create(data: { email: string; passwordHash: string; firstName: string; lastName: string; phone?: string; role?: string; legal?: Record<string, unknown> }) {
    try {
      return await this.users.create({ ...data, ...(data.phone ? { phoneKey: phoneKey(data.phone) } : {}) } as never);
    } catch (e) {
      throw this.mapDuplicate(e);
    }
  }

  /** Зберігає юридичні дані для договору; посвідчення водія, додане окремо, лишається як було */
  async setLegal(id: string, legal: LegalProfile) {
    const existing = await this.users.findById(id, 'legal').lean().exec();
    const license = existing?.legal?.license;
    return this.users.findByIdAndUpdate(id, { $set: { legal: { ...legal, ...(license ? { license } : {}) } } }, { new: true }).exec();
  }

  /** Зберігає посвідчення водія (окремо від решти даних для договору); null — прибрати */
  setLicense(id: string, license: LegalProfile['license'] | null) {
    return this.users.findByIdAndUpdate(id, license ? { $set: { 'legal.license': license } } : { $unset: { 'legal.license': '' } }, { new: true }).exec();
  }

  async update(id: string, patch: Partial<Pick<User, 'onboarded' | 'dismissedHints' | 'theme' | 'firstName' | 'lastName' | 'phone'>>) {
    if (patch.phone && (await this.phoneTaken(patch.phone, id))) throw new ConflictException(PHONE_TAKEN);
    try {
      return await this.users.findByIdAndUpdate(id, { $set: { ...patch, ...(patch.phone ? { phoneKey: phoneKey(patch.phone) } : {}) } }, { new: true }).exec();
    } catch (e) {
      throw this.mapDuplicate(e);
    }
  }

  /** Гонка двох запитів із тим самим номером закінчується помилкою індексу: перетворюємо її на зрозумілу відповідь */
  private mapDuplicate(e: unknown) {
    const err = e as { code?: number; keyPattern?: Record<string, unknown> };
    if (err?.code === 11000 && err.keyPattern?.phoneKey) return new ConflictException(PHONE_TAKEN);
    return e;
  }

  /** Публічне представлення користувача для клієнта */
  toPublic(user: UserDocument) {
    return user.toJSON();
  }
}
