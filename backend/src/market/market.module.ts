import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

@Module({ imports: [CatalogModule], controllers: [MarketController], providers: [MarketService] })
export class MarketModule {}
