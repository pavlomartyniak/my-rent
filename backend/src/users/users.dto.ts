import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

import { ABROAD_POLICIES, ACCIDENTS, HANDOVERS, HOSTING_EXPERIENCES, INSURANCES, MILEAGE_LIMITS, REPLY_TIMES, SERVICE_CARES, DEPOSIT_READINESS, LICENSE_CATEGORIES, OCCUPATIONS, RENT_EXPERIENCES, RENT_PURPOSES, RENT_TERMS, THEMES, TRANSMISSIONS } from '../common/constants';
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

  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть по батькові' })
  @MaxLength(50, { message: 'По батькові занадто довге' })
  middleName?: string;

  /** Телефон обов'язковий: очистити його не можна */
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть номер телефону' })
  @Matches(PHONE_PATTERN, { message: 'Невірний формат телефону' })
  phone?: string;

  /** Місто (необов'язково): можна й очистити */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'Назва міста задовга' })
  city?: string;

  /** Фото профілю: посилання на власне фото в хмарі або порожній рядок, щоб прибрати */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUri?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Опис задовгий (до 300 символів)' })
  about?: string;

  /** Рік, з якого водить; null прибирає */
  @IsOptional()
  @IsInt({ message: 'Вкажіть рік цифрами' })
  @Min(1950, { message: 'Рік не раніше 1950' })
  @Max(new Date().getFullYear(), { message: 'Рік не може бути в майбутньому' })
  drivingSince?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(RENT_PURPOSES, { each: true })
  purposes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(LICENSE_CATEGORIES, { each: true })
  licenseCategories?: string[];

  /** Порожній рядок прибирає відповідь */
  @IsOptional()
  @IsIn([...ACCIDENTS, ''])
  accidents?: string;

  @IsOptional()
  @IsIn([...RENT_EXPERIENCES, ''])
  rentExperience?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsIn(OCCUPATIONS, { each: true })
  occupations?: string[];

  @IsOptional()
  @IsIn([...RENT_TERMS, ''])
  rentTerm?: string;

  @IsOptional()
  @IsIn([...DEPOSIT_READINESS, ''])
  depositReady?: string;

  @IsOptional()
  @IsIn([...TRANSMISSIONS, ''])
  transmission?: string;

  @IsOptional()
  @IsIn([...REPLY_TIMES, ''])
  replyTime?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(HANDOVERS, { each: true })
  handovers?: string[];

  @IsOptional()
  @IsIn([...HOSTING_EXPERIENCES, ''])
  hostingExperience?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(INSURANCES, { each: true })
  insurances?: string[];

  @IsOptional()
  @IsIn([...SERVICE_CARES, ''])
  serviceCare?: string;

  @IsOptional()
  @IsIn([...MILEAGE_LIMITS, ''])
  mileageLimit?: string;

  /** Км на добу; null прибирає */
  @IsOptional()
  @IsInt({ message: 'Вкажіть кілометри цифрами' })
  @Min(1, { message: 'Ліміт не менше 1 км' })
  @Max(2000, { message: 'Ліміт не більше 2000 км на добу' })
  mileageKm?: number | null;

  @IsOptional()
  @IsIn([...ABROAD_POLICIES, ''])
  abroad?: string;

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
