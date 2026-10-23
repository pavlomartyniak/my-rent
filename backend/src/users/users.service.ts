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

  findById(id: string) {
    return this.users.findById(id).exec();
  }

  create(data: { email: string; passwordHash: string; firstName: string; lastName: string; phone?: string }) {
    return this.users.create(data);
  }

  update(id: string, patch: Partial<Pick<User, 'isPro' | 'onboarded' | 'dismissedHints' | 'theme' | 'firstName' | 'lastName' | 'phone'>>) {
    return this.users.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec();
  }

  /** Публічне представлення користувача для клієнта */
  toPublic(user: UserDocument) {
    return user.toJSON();
  }
}
