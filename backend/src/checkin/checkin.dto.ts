import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { EVERY } from './checkin.rules';

export class SettingsDto {
  @IsBoolean()
  enabled: boolean;

  @IsIn(EVERY)
  every: string;

  /** 0 — неділя … 6 — субота */
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsBoolean()
  body: boolean;

  @IsBoolean()
  interior: boolean;
}

export class SignatureDto {
  @IsInt()
  @Min(1)
  @Max(10)
  count: number;
}

class PhotoDto {
  @IsString()
  @MaxLength(30)
  slot: string;

  @IsString()
  @MaxLength(600)
  url: string;
}

export class SubmitDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PhotoDto)
  photos: PhotoDto[];

  @IsInt({ message: 'Вкажіть пробіг цілим числом' })
  @Min(0)
  @Max(2_000_000)
  km: number;
}
