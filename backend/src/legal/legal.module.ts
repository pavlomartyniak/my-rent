import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Deal, DealSchema } from '../schemas/deal.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { LegalController } from './legal.controller';

@Module({ imports: [MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Deal.name, schema: DealSchema },
    ])], controllers: [LegalController] })
export class LegalModule {}
