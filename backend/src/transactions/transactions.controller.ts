import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, Max, Min } from 'class-validator';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { CreateTransactionDto, UpdateTransactionDto } from './transactions.dto';
import { TransactionsService } from './transactions.service';

class HistoryQuery {
  @IsMongoId()
  carId: string;

  /** Скільки найновіших місяців віддати (за замовчуванням 2) */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  months = 2;
}

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('carId', new ParseObjectIdPipe()) carId?: string) {
    return this.transactions.list(user.id, carId);
  }

  /** Історія авто по місяцях із підсумками (частинами) */
  @Header('Cache-Control', 'no-store')
  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query() { carId, months }: HistoryQuery) {
    return this.transactions.history(user.id, carId, months);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.transactions.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransactionDto) {
    return this.transactions.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactions.update(user.id, id, dto);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.transactions.remove(user.id, id);
  }
}
