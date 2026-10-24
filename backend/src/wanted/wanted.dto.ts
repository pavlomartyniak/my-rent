import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';

import { IsIsoDay } from '../common/is-iso-day';
import { Trim } from '../common/profile';

export class CreateWantedDto {
  /** Необов'язкові: без них — «будь-яке авто» */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  brand?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  model?: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть місто' })
  @MaxLength(60, { message: 'Назва міста занадто довга' })
  city: string;

  @IsIsoDay()
  startDate: string;

  @IsIsoDay()
  endDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'Бюджет має бути більшим за нуль' })
  @Max(1_000_000)
  maxPricePerDay?: number;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Побажання занадто довгі' })
  notes?: string;
}

export class BoardQuery {
  /** Місто (за частиною назви) */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  /** Область з довідника: усі її міста (діє, якщо місто не вказано) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  regionId?: number;

  /** Марка або модель */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
