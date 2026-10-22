import { OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, MaxLength, ValidateNested } from 'class-validator';

import { CreateCarDto } from '../cars/cars.dto';
import { CreateReminderDto } from '../reminders/reminders.dto';
import { CreateTransactionDto } from '../transactions/transactions.dto';

/** Для імпорту `id` — це довільний ідентифікатор клієнта, за яким зв'язуються записи й нагадування */
export class ImportCarDto extends CreateCarDto {
  @IsString()
  @MaxLength(64)
  id: string;
}

export class ImportTransactionDto extends OmitType(CreateTransactionDto, ['carId'] as const) {
  @IsString()
  @MaxLength(64)
  carId: string;
}

export class ImportReminderDto extends OmitType(CreateReminderDto, ['carId', 'notificationIds'] as const) {
  @IsString()
  @MaxLength(64)
  carId: string;
}

export class ImportDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ImportCarDto)
  cars: ImportCarDto[];

  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportTransactionDto)
  transactions: ImportTransactionDto[];

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportReminderDto)
  reminders: ImportReminderDto[];
}
