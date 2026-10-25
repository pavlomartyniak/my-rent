import { Type } from 'class-transformer';
import { IsIn, IsMongoId, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength } from 'class-validator';

import { Trim } from '../common/profile';

export class CreateOfferDto {
  @IsMongoId()
  carId: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'Ціна за добу має бути більшою за нуль' })
  @Max(1_000_000)
  pricePerDay: number;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Повідомлення занадто довге' })
  message?: string;

  /** План оплати: одразу вся сума (за замовчуванням) чи щомісяця (від 60 діб) */
  @IsOptional()
  @IsIn(['lump', 'monthly'])
  paymentPlan?: 'lump' | 'monthly';
}

export class DeclineOfferDto {
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Коментар занадто довгий' })
  note?: string;
}
