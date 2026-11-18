import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Car, CarSchema } from '../schemas/car.schema';
import { Deal, DealSchema } from '../schemas/deal.schema';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Car.name, schema: CarSchema },
      { name: Deal.name, schema: DealSchema },
    ]),
  ],
  controllers: [InsuranceController],
  providers: [InsuranceService],
  exports: [InsuranceService],
})
export class InsuranceModule {}
