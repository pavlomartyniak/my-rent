import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';

import { CAR_STATUSES } from '../common/constants';
import { IsIsoDay } from '../common/is-iso-day';
import { Trim } from '../common/profile';

export class CreateCarDto {
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть марку' })
  @MaxLength(60)
  brand: string;

  @IsString()
  @IsNotEmpty({ message: 'Вкажіть модель' })
  @MaxLength(60)
  model: string;

  @IsInt()
  @Min(1980)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsString()
  @MaxLength(17)
  vin?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5_000_000)
  mileage?: number;

  @IsIsoDay()
  rentStart: string;

  @IsNumber()
  @IsPositive()
  @Max(1_000_000_000)
  price: number;

  @IsOptional()
  @IsIn(CAR_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  driver?: string;

  /** Локальний URI фото; завантаження файлів поки не підтримується */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  photoUri?: string;
}

export class UpdateCarDto extends PartialType(CreateCarDto) {}

/** Оголошення про оренду: що бачать орендарі */
export class ListingDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть місто' })
  @MaxLength(60, { message: 'Назва міста занадто довга' })
  city: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'Ціна за добу має бути більшою за нуль' })
  @Max(1_000_000)
  pricePerDay: number;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Опис занадто довгий' })
  description?: string;
}
