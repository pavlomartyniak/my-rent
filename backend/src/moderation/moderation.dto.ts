import { IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

import { REPORT_KINDS, REPORT_REASONS } from './moderation.constants';

export class CreateReportDto {
  @IsIn(REPORT_KINDS)
  kind: (typeof REPORT_KINDS)[number];

  @IsIn(REPORT_REASONS)
  reason: (typeof REPORT_REASONS)[number];

  /** Оголошення (kind = listing) */
  @IsOptional()
  @IsMongoId()
  carId?: string;

  /** Користувач (kind = user) */
  @IsOptional()
  @IsMongoId()
  userId?: string;

  /** Повідомлення в чаті (kind = message) */
  @IsOptional()
  @IsMongoId()
  messageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Кого заблокувати: напряму або власника оголошення */
export class CreateBlockDto {
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @IsMongoId()
  carId?: string;
}
