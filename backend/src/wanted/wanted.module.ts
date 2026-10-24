import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { OffersService } from '../offers/offers.service';
import { WantedController } from './wanted.controller';
import { WantedService } from './wanted.service';

@Module({ imports: [CatalogModule], controllers: [WantedController], providers: [WantedService, OffersService] })
export class WantedModule {}
