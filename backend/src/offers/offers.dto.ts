import { Type } from 'class-transformer';
import { IsIn, IsMongoId, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength } from 'class-validator';

import { Trim } from '../common/profile';
import { PAYMENT_PLANS } from '../deals/payment-plan';

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

  /** План оплати: одразу вся сума (за замовчуванням), щотижня чи щодня */
  @IsOptional()
  @IsIn(PAYMENT_PLANS)
  paymentPlan?: (typeof PAYMENT_PLANS)[number];
}

export class DeclineOfferDto {
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Коментар занадто довгий' })
  note?: string;
}
