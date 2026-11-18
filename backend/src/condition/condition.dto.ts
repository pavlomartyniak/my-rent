import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { Trim } from '../common/profile';

export class SignatureDto {
  @IsInt()
  @Min(1)
  @Max(10)
  count: number;
}

export class PhotoDto {
  /** Слот фото: front, rear, left, right, dashboard, seatsFront, seatsRear, trunk, wheels чи damage (пошкодження) */
  @IsString()
  @IsIn(['front', 'rear', 'left', 'right', 'dashboard', 'seatsFront', 'seatsRear', 'trunk', 'wheels', 'damage'])
  slot: string;

  @IsString()
  @MaxLength(600)
  url: string;

  /** Опис, обов'язковий для пошкодження */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Опис задовгий (до 300 символів)' })
  note?: string;
}

export class OdometerDto {
  @IsInt({ message: 'Вкажіть пробіг цілим числом' })
  @Min(0)
  @Max(2_000_000)
  km: number;
}
