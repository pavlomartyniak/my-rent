import { PartialType } from '@nestjs/mapped-types';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

import { REMINDER_KINDS } from '../common/constants';
import { IsIsoDay } from '../common/is-iso-day';

export class CreateReminderDto {
  @IsMongoId()
  carId: string;

  @IsIn(REMINDER_KINDS)
  kind: string;

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
