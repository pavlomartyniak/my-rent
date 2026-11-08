import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../common/current-user';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResendRegistrationDto, ResetPasswordDto, VerifyRegistrationDto } from './auth.dto';
import { AuthService } from './auth.service';

// Суворіший ліміт на автентифікацію: 10 запитів на хвилину з однієї IP
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Перший крок реєстрації: зберігає форму й надсилає код на пошту. Акаунт створюється після підтвердження коду */
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  /** Другий крок: код із листа створює акаунт і одразу входить */
  @HttpCode(200)
  @Post('register/verify')
  verifyRegistration(@Body() dto: VerifyRegistrationDto) {
    return this.auth.verifyRegistration(dto);
  }

  /** Надіслати код реєстрації ще раз */
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register/resend')
  resendRegistration(@Body() dto: ResendRegistrationDto) {
    return this.auth.resendRegistration(dto.email);
  }

  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** Надіслати код відновлення на пошту. Відповідь однакова, чи є такий акаунт, щоб не розкривати email */
  @HttpCode(204)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgot(dto.email);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset')
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.reset(dto);
  }
}
