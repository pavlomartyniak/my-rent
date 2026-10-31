import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { FUEL_TYPES } from '../common/constants';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { MarketService } from './market.service';

class SearchQuery {
  /** Місто (пошук за частиною назви, без урахування регістру) */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  /** Область з довідника: усі її міста (діє, якщо місто не вказано) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  regionId?: number;

  /** Марка або модель */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  /** Марка (точний збіг) */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  brand?: string;

  /** Модель (точний збіг) */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  model?: string;

  @IsOptional()
  @IsIn(FUEL_TYPES)
  fuel?: string;

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDeposit?: number;

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
  search(@CurrentUser() user: AuthUser, @Query() query: SearchQuery) {
    return this.market.search(query, user.role === 'renter' ? user.id : undefined);
  }

  @Header('Cache-Control', 'no-store')
  @Get('cars/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.market.get(id, user.role === 'renter' ? user.id : undefined);
  }
}
