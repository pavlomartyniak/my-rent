import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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

/** Юридичні дані для договору. Вкладені об'єкти перевіряє й нормалізує legal.ts */
export class UpdateLegalDto {
  @IsIn(['individual', 'fop'], { message: 'Оберіть: ФОП чи фізична особа' })
  partyType: 'individual' | 'fop';

  @IsOptional()
  @IsString()
  @MaxLength(10)
  kved?: string;

  @IsString()
  @MaxLength(50)
  middleName: string;

  @IsString()
  @MaxLength(20)
  rnokpp: string;

  @IsObject()
  idDoc: { type: 'passport_book' | 'id_card'; series: string; number: string; issuedBy: string; issuedAt: string };

  @IsString()
  @MaxLength(200)
  address: string;
}

/** Посвідчення водія орендаря: серія, номер, строк дії. Порожнє значення прибирає посвідчення */
export class UpdateLicenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  series?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  validUntil?: string;
}
