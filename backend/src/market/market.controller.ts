import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { MarketService } from './market.service';

class SearchQuery {
  /** Місто (пошук за частиною назви, без урахування регістру) */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  /** Марка або модель */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

// Каталог оголошень змінюється постійно, тож не кешується; доступний обом типам акаунтів
@Controller('market')
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Header('Cache-Control', 'no-store')
  @Get('cars')
  search(@Query() query: SearchQuery) {
    return this.market.search(query);
  }

  @Header('Cache-Control', 'no-store')
  @Get('cars/:id')
  get(@Param('id', ParseObjectIdPipe) id: string) {
    return this.market.get(id);
  }
}
