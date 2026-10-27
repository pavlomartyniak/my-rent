import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

import { ROLES } from '../common/constants';
import { PHONE_PATTERN, Trim } from '../common/profile';

export class RegisterDto {
  /** Тип акаунта; за замовчуванням власник */
  @IsOptional()
  @IsIn(ROLES)
  role?: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть ім’я' })
  @MaxLength(50, { message: 'Ім’я занадто довге' })
  firstName: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Вкажіть прізвище' })
  @MaxLength(50, { message: 'Прізвище занадто довге' })
  lastName: string;

  /** Необов'язковий; порожній рядок дозволений */
  @Trim()
  @IsOptional()
  @ValidateIf((o: RegisterDto) => !!o.phone)
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'Невірний формат телефону' })
  phone?: string;

  @IsEmail({}, { message: 'Невірний формат email' })
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8, { message: 'Пароль має містити щонайменше 8 символів' })
  @MaxLength(72, { message: 'Пароль занадто довгий' })
  password: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Невірний формат email' })
  email: string;

  @IsString()
  @MaxLength(72)
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Невірний формат email' })
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Невірний формат email' })
  @MaxLength(254)
  email: string;

  @Matches(/^\d{6}$/, { message: 'Код складається з 6 цифр' })
  code: string;

  @IsString()
  @MinLength(8, { message: 'Пароль має містити щонайменше 8 символів' })
  @MaxLength(72, { message: 'Пароль занадто довгий' })
  password: string;
}
