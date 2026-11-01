import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CarsModule } from '../cars/cars.module';
import { PaymentOrder, PaymentOrderSchema } from '../schemas/payment-order.schema';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: PaymentOrder.name, schema: PaymentOrderSchema }]), CarsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
