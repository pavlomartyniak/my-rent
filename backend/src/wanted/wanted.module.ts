import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { ChatModule } from '../chat/chat.module';
import { OffersService } from '../offers/offers.service';
import { WantedController } from './wanted.controller';
import { WantedService } from './wanted.service';

@Module({ imports: [CatalogModule, ChatModule], controllers: [WantedController], providers: [WantedService, OffersService] })
export class WantedModule {}
