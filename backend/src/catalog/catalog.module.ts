import { Module } from '@nestjs/common';

import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PlacesService } from './places.service';

@Module({ controllers: [CatalogController], providers: [CatalogService, PlacesService], exports: [PlacesService] })
export class CatalogModule {}
