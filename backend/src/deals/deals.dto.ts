import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TerminateDealDto {
  /** Причина розірвання; бачить друга сторона */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
