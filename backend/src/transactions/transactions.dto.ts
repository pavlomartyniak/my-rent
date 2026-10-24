import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsMongoId, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength } from 'class-validator';

import { TRANSACTION_TYPES } from '../common/constants';
import { IsIsoDay } from '../common/is-iso-day';

export class CreateTransactionDto {
  /** Власник вказує авто, орендар — оренду (dealId) */
  @IsOptional()
  @IsMongoId()
  carId?: string;

  @IsOptional()
  @IsMongoId()
  dealId?: string;

  @IsIn(TRANSACTION_TYPES)
  type: 'income' | 'expense';

  @IsNumber()
  @IsPositive({ message: 'Сума має бути більшою за нуль' })
  @Max(1_000_000_000)
  amount: number;

  @IsIsoDay()
  date: string;

  @IsString()
  @MaxLength(40)
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
