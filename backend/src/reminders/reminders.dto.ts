import { PartialType } from '@nestjs/mapped-types';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

import { REMINDER_KINDS } from '../common/constants';
import { IsIsoDay } from '../common/is-iso-day';

export class CreateReminderDto {
  @IsMongoId()
  carId: string;

  @IsIn(REMINDER_KINDS)
  kind: string;

  /** Що саме нагадати: обов'язково для «Інше», для решти типів не потрібне */
  @ValidateIf((o: CreateReminderDto) => o.kind === 'Інше')
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть, що саме нагадати' })
  @MaxLength(60, { message: 'Опис задовгий (до 60 символів)' })
  note?: string;

  @IsIsoDay()
  date: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  notificationIds?: string[];
}

export class UpdateReminderDto extends PartialType(CreateReminderDto) {}
