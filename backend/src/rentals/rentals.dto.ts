import { IsBoolean, IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

import { IsIsoDay } from '../common/is-iso-day';
import { Trim } from '../common/profile';
import { PAYMENT_PLANS } from '../deals/payment-plan';

export class CreateRentalDto {
  @IsMongoId()
  carId: string;

  @IsIsoDay()
  startDate: string;

  @IsIsoDay()
  endDate: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Повідомлення занадто довге' })
  message?: string;

  /** План оплати: одразу вся сума (за замовчуванням), щотижня чи щодня */
  @IsOptional()
  @IsIn(PAYMENT_PLANS)
  paymentPlan?: (typeof PAYMENT_PLANS)[number];

  /** Мета використання: особисті потреби, перевезення пасажирів чи доставка (потрапляє в договір) */
  @IsOptional()
  @IsIn(['personal', 'passengers', 'delivery'])
  purpose?: 'personal' | 'passengers' | 'delivery';
}

export class AcceptRentalDto {
  /** Укласти договір (за замовчуванням) чи здати без договору: тоді орендар має погодитись із таким режимом, підтвердивши умови */
  @IsOptional()
  @IsBoolean()
  withContract?: boolean;
}

export class DeclineRentalDto {
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Коментар занадто довгий' })
  note?: string;
}
