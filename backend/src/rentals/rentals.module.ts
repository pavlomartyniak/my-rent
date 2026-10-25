import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';

@Module({ imports: [ChatModule], controllers: [RentalsController], providers: [RentalsService] })
export class RentalsModule {}
