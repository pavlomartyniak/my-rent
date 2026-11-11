import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { THEMES } from '../common/constants';
import { PHONE_PATTERN, Trim } from '../common/profile';

export class UpdateMeDto {
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть ім’я' })
  @MaxLength(50, { message: 'Ім’я занадто довге' })
  firstName?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть прізвище' })
  @MaxLength(50, { message: 'Прізвище занадто довге' })
  lastName?: string;

  /** Телефон обов'язковий: очистити його не можна */
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть номер телефону' })
  @Matches(PHONE_PATTERN, { message: 'Невірний формат телефону' })
  phone?: string;

  @IsOptional()
  @IsBoolean()
  onboarded?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  dismissedHints?: string[];

  @IsOptional()
  @IsIn(THEMES)
  theme?: string;
}
