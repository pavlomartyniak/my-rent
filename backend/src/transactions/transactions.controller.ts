import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Matches, Max, Min } from 'class-validator';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { CreateTransactionDto, UpdateTransactionDto } from './transactions.dto';
import { TransactionsService } from './transactions.service';

class HistoryQuery {
  @IsOptional()
  @IsMongoId()
  carId?: string;

  @IsOptional()
  @IsMongoId()
  dealId?: string;

  /** Скільки найновіших місяців віддати (за замовчуванням 2) */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  months = 2;
}

class MonthQuery {
  /** Місяць вигляду YYYY-MM або рік YYYY (стовпчик графіка за весь час) */
  @Matches(/^\d{4}(-(0[1-9]|1[0-2]))?$/, { message: 'Період має вигляд РРРР-ММ або РРРР' })
  period: string;

  @IsOptional()
  @IsMongoId()
  carId?: string;

  @IsOptional()
  @IsMongoId()
  dealId?: string;
}

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('carId', new ParseObjectIdPipe()) carId?: string) {
    return this.transactions.list(user, carId);
  }

  /** Історія авто по місяцях із підсумками (частинами) */
  @Header('Cache-Control', 'no-store')
  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query() { carId, dealId, months }: HistoryQuery) {
    return this.transactions.history(user, { carId, dealId }, months);
  }

  /** Записи за вибраний місяць чи рік у звітах: що саме було доходом і на що пішли витрати */
  @Header('Cache-Control', 'no-store')
  @Get('period')
  period(@CurrentUser() user: AuthUser, @Query() { period, carId, dealId }: MonthQuery) {
    return this.transactions.inPeriod(user, period, { carId, dealId });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.transactions.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransactionDto) {
    return this.transactions.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactions.update(user, id, dto);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.transactions.remove(user.id, id);
  }
}
