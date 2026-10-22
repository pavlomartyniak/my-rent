import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
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
