import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Car, CarSchema } from '../schemas/car.schema';
import { Conversation, ConversationSchema } from '../schemas/conversation.schema';
import { Message, MessageSchema } from '../schemas/message.schema';
import { Deal, DealSchema } from '../schemas/deal.schema';
import { Reminder, ReminderSchema } from '../schemas/reminder.schema';
import { RentalRequest, RentalRequestSchema } from '../schemas/rental-request.schema';
import { Transaction, TransactionSchema } from '../schemas/transaction.schema';
import { Offer, OfferSchema } from '../schemas/offer.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { WantedRequest, WantedRequestSchema } from '../schemas/wanted-request.schema';

/** Усі моделі в одному місці, доступні сервісам без повторних реєстрацій */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Car.name, schema: CarSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Reminder.name, schema: ReminderSchema },
      { name: RentalRequest.name, schema: RentalRequestSchema },
      { name: WantedRequest.name, schema: WantedRequestSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Deal.name, schema: DealSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
