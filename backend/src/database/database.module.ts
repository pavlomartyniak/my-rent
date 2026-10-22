import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Car, CarSchema } from '../schemas/car.schema';
import { Reminder, ReminderSchema } from '../schemas/reminder.schema';
import { Transaction, TransactionSchema } from '../schemas/transaction.schema';
import { User, UserSchema } from '../schemas/user.schema';

/** Усі моделі в одному місці, доступні сервісам без повторних реєстрацій */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Car.name, schema: CarSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Reminder.name, schema: ReminderSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
