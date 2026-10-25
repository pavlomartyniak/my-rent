import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength } from 'class-validator';

export class ConfirmPaymentDto {
  /** Скільки сплачено чи отримано за цей платіж; без суми — повна сума платежу */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'Сума має бути більшою за нуль' })
  @Max(1_000_000_000)
  amount?: number;
}

export class TerminateDealDto {
  /** Причина розірвання; бачить друга сторона */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
