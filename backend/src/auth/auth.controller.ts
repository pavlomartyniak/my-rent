import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../common/current-user';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';

// Суворіший ліміт на автентифікацію: 10 запитів на хвилину з однієї IP
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}
