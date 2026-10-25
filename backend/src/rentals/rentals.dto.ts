import { IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

import { IsIsoDay } from '../common/is-iso-day';
import { Trim } from '../common/profile';

export class CreateRentalDto {
  @IsMongoId()
  carId: string;

  @IsIsoDay()
  startDate: string;

  @IsIsoDay()
  endDate: string;

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

export class DeclineRentalDto {
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Коментар занадто довгий' })
  note?: string;
}
