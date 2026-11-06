import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { IsMongoId, IsOptional, Matches } from 'class-validator';

import { type AuthUser, CurrentUser, Roles } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { ReportsService } from './reports.service';

class PeriodQuery {
  /** Місяць `2026-10`, рік `2026` або `all` — увесь час; за замовчуванням поточний місяць */
  @IsOptional()
  @Matches(/^(all|\d{4}(-\d{2})?)$/, { message: 'Період має бути у форматі РРРР-ММ, РРРР або all' })
  period?: string;
}

class CategoriesQuery extends PeriodQuery {
  @IsOptional()
  @IsMongoId()
  carId?: string;

  @IsOptional()
  @IsMongoId()
  dealId?: string;
}

// Звіти залежать від даних, що змінюються в будь-який момент, тож не кешуються
const NO_CACHE = 'no-store';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Загальний звіт за період */
  @Roles('owner')
  @Header('Cache-Control', NO_CACHE)
  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() { period }: PeriodQuery) {
    return this.reports.summary(user.id, period);
  }

  /** Детальний звіт по авто */
  @Roles('owner')
  @Header('Cache-Control', NO_CACHE)
  @Get('cars/:id')
  car(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Query() { period }: PeriodQuery) {
    return this.reports.car(user.id, id, period);
  }

  /** Витрати за категоріями за вибраний період (для обох ролей); `carId` чи `dealId` звужують вибірку */
  @Header('Cache-Control', NO_CACHE)
  @Get('categories')
  categories(@CurrentUser() user: AuthUser, @Query() { period, carId, dealId }: CategoriesQuery) {
    return this.reports.categoriesReport(user.id, { carId, dealId }, period);
  }

  /** Звіт орендаря за період */
  @Roles('renter')
  @Header('Cache-Control', NO_CACHE)
  @Get('renter/summary')
  renterSummary(@CurrentUser() user: AuthUser, @Query() { period }: PeriodQuery) {
    return this.reports.renterSummary(user.id, period);
  }

  /** Детальний звіт по одній оренді орендаря */
  @Roles('renter')
  @Header('Cache-Control', NO_CACHE)
  @Get('renter/deals/:id')
  renterDeal(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Query() { period }: PeriodQuery) {
    return this.reports.renterDeal(user.id, id, period);
  }
}
