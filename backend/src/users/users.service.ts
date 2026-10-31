import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

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

  create(data: { email: string; passwordHash: string; firstName: string; lastName: string; phone?: string; role?: string }) {
    return this.users.create(data);
  }

  update(id: string, patch: Partial<Pick<User, 'onboarded' | 'dismissedHints' | 'theme' | 'firstName' | 'lastName' | 'phone'>>) {
    return this.users.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec();
  }

  /** Публічне представлення користувача для клієнта */
  toPublic(user: UserDocument) {
    return user.toJSON();
  }
}
