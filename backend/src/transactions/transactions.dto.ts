import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsMongoId, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength } from 'class-validator';

import { EXPENSE_CATEGORIES, INCOME_CATEGORY, TRANSACTION_TYPES } from '../common/constants';
import { IsIsoDay } from '../common/is-iso-day';

export class CreateTransactionDto {
  @IsMongoId()
  carId: string;

  @IsIn(TRANSACTION_TYPES)
  type: 'income' | 'expense';

  @IsNumber()
  @IsPositive({ message: 'Сума має бути більшою за нуль' })
  @Max(1_000_000_000)
  amount: number;

  @IsIsoDay()
  date: string;

  @IsIn([INCOME_CATEGORY, ...EXPENSE_CATEGORIES])
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  driver?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}
