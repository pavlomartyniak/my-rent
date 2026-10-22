import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { Car } from '../schemas/car.schema';
import { Reminder } from '../schemas/reminder.schema';
import type { CreateReminderDto, UpdateReminderDto } from './reminders.dto';

@Injectable()
export class RemindersService {
  constructor(
    @InjectModel(Reminder.name) private readonly reminders: Model<Reminder>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
  ) {}

  list(userId: string) {
    return this.reminders.find({ userId }).sort({ date: 1, _id: 1 }).exec();
  }

  async create(userId: string, dto: CreateReminderDto) {
    await this.assertCar(userId, dto.carId);
    return this.reminders.create({ ...dto, userId });
  }

  async update(userId: string, id: string, dto: UpdateReminderDto) {
    if (dto.carId) await this.assertCar(userId, dto.carId);
    const reminder = await this.reminders.findOneAndUpdate({ _id: id, userId }, { $set: dto }, { new: true, runValidators: true }).exec();
    if (!reminder) throw new NotFoundException('Нагадування не знайдено');
    return reminder;
  }

  async remove(userId: string, id: string) {
    const res = await this.reminders.deleteOne({ _id: id, userId }).exec();
    if (!res.deletedCount) throw new NotFoundException('Нагадування не знайдено');
  }

  private async assertCar(userId: string, carId: string) {
    if (!(await this.cars.exists({ _id: carId, userId }))) throw new NotFoundException('Авто не знайдено');
  }
}
