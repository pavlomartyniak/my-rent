import { Module } from '@nestjs/common';

import { OffersService } from '../offers/offers.service';
import { WantedController } from './wanted.controller';
import { WantedService } from './wanted.service';

@Module({ controllers: [WantedController], providers: [WantedService, OffersService] })
export class WantedModule {}
