import { Controller, Get, Header, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { CatalogService } from './catalog.service';

class BrandsQuery {
  /** Пошук за назвою марки (латиницею або кирилицею) */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;
}

class ModelsQuery extends BrandsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  brandId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

// Довідник змінюється рідко, тож клієнт може кешувати відповіді (Cache-Control на кожному методі)
const CACHE = 'private, max-age=3600';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Усі марки; `?q=` — швидкий пошук */
  @Header('Cache-Control', CACHE)
  @Get('brands')
  brands(@Query() { q }: BrandsQuery) {
    return this.catalog.brandsList(q);
  }

  /** Моделі; `?brandId=` — однієї марки, `?q=` — пошук за маркою чи моделлю, `?limit=` (до 200) */
  @Header('Cache-Control', CACHE)
  @Get('models')
  models(@Query() query: ModelsQuery) {
    return this.catalog.modelsList(query);
  }

  /** Модель з поколіннями */
  @Header('Cache-Control', CACHE)
  @Get('models/:id')
  model(@Param('id', ParseIntPipe) id: number) {
    return this.catalog.model(id);
  }
}
