import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Car, CarSchema } from '../schemas/car.schema';
import { Conversation, ConversationSchema } from '../schemas/conversation.schema';
import { Deal, DealSchema } from '../schemas/deal.schema';
import { Offer, OfferSchema } from '../schemas/offer.schema';
import { RentalRequest, RentalRequestSchema } from '../schemas/rental-request.schema';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Car.name, schema: CarSchema },
      { name: Deal.name, schema: DealSchema },
      { name: RentalRequest.name, schema: RentalRequestSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
