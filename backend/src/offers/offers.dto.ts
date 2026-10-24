import { Type } from 'class-transformer';
import { IsMongoId, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength } from 'class-validator';

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
}

export class DeclineOfferDto {
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Коментар занадто довгий' })
  note?: string;
}
