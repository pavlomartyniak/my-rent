import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Car, CarSchema } from '../schemas/car.schema';
import { Deal, DealSchema } from '../schemas/deal.schema';
import { Offer, OfferSchema } from '../schemas/offer.schema';
import { RentalRequest, RentalRequestSchema } from '../schemas/rental-request.schema';
import { Review, ReviewSchema } from '../schemas/review.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Car.name, schema: CarSchema },
      { name: Deal.name, schema: DealSchema },
      { name: RentalRequest.name, schema: RentalRequestSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
  ],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
