import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';

import { CAR_STATUSES, FUEL_TYPES, MAX_PHOTOS } from '../common/constants';
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

  /** Тип палива; порожній рядок — не вказано */
  @IsOptional()
  @IsIn([...FUEL_TYPES, ''])
  fuel?: string;

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

  /** Галерея; перше фото стає обкладинкою (photoUri) */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS, { message: `Можна додати до ${MAX_PHOTOS} фото` })
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  photos?: string[];
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

  /** Застава, грн; без значення чи 0 — без застави */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Застава не може бути від’ємною' })
  @Max(10_000_000)
  deposit?: number;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Опис занадто довгий' })
  description?: string;
}
