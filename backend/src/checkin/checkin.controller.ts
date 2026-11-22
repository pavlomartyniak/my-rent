import { Body, Controller, Get, Header, HttpCode, Param, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { SettingsDto, SignatureDto, SubmitDto } from './checkin.dto';
import { CheckinService } from './checkin.service';

/** Регулярний фотозвіт орендаря про авто: налаштування власника, надсилання, історія */
@Controller('checkin')
export class CheckinController {
  constructor(private readonly checkin: CheckinService) {}

  /** Оренди, де звіт чекає дії: для блоку «Потрібна ваша увага» */
  @Header('Cache-Control', 'no-store')
  @Get()
  attention(@CurrentUser() user: AuthUser) {
    return this.checkin.attention(user);
  }

  @Header('Cache-Control', 'no-store')
  @Get(':dealId')
  get(@CurrentUser() user: AuthUser, @Param('dealId', ParseObjectIdPipe) dealId: string) {
    return this.checkin.get(user, dealId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Put(':dealId/settings')
  settings(@CurrentUser() user: AuthUser, @Param('dealId', ParseObjectIdPipe) dealId: string, @Body() dto: SettingsDto) {
    return this.checkin.setSettings(user, dealId, dto);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':dealId/signature')
  signature(@CurrentUser() user: AuthUser, @Param('dealId', ParseObjectIdPipe) dealId: string, @Body() dto: SignatureDto) {
    return this.checkin.signature(user, dealId, dto.count);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':dealId/submit')
  submit(@CurrentUser() user: AuthUser, @Param('dealId', ParseObjectIdPipe) dealId: string, @Body() dto: SubmitDto) {
    return this.checkin.submit(user, dealId, dto);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':dealId/remind')
  remind(@CurrentUser() user: AuthUser, @Param('dealId', ParseObjectIdPipe) dealId: string) {
    return this.checkin.remind(user, dealId);
  }
}
