import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

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
}

export class DeclineRentalDto {
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Коментар занадто довгий' })
  note?: string;
}
