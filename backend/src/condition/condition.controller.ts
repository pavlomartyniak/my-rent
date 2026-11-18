import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseEnumPipe, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { OdometerDto, PhotoDto, SignatureDto } from './condition.dto';
import { type Phase, PHASES } from './condition.rules';
import { ConditionService } from './condition.service';

const phasePipe = new ParseEnumPipe(Object.fromEntries(PHASES.map((p) => [p, p])));

@Controller('condition')
export class ConditionController {
  constructor(private readonly condition: ConditionService) {}

  /** Стан авто в оренді: фото при передачі й поверненні, права на зміни (для обох сторін оренди) */
  @Header('Cache-Control', 'no-store')
  @Get(':dealId')
  get(@CurrentUser() user: AuthUser, @Param('dealId', ParseObjectIdPipe) dealId: string) {
    return this.condition.get(user, dealId);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':dealId/signature')
  signature(@CurrentUser() user: AuthUser, @Param('dealId', ParseObjectIdPipe) dealId: string, @Body() dto: SignatureDto) {
    return this.condition.signature(user, dealId, dto.count);
  }

  /** Орендар погоджується зі станом авто при передачі: після цього відкривається підписання */
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':dealId/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('dealId', ParseObjectIdPipe) dealId: string) {
    return this.condition.confirm(user, dealId);
  }

  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Put(':dealId/:phase/photo')
  putPhoto(@CurrentUser() user: AuthUser, @Param('dealId', ParseObjectIdPipe) dealId: string, @Param('phase', phasePipe) phase: Phase, @Body() dto: PhotoDto) {
    return this.condition.putPhoto(user, dealId, phase, dto);
  }

  @Delete(':dealId/:phase/photo/:photoId')
  deletePhoto(@CurrentUser() user: AuthUser, @Param('dealId', ParseObjectIdPipe) dealId: string, @Param('phase', phasePipe) phase: Phase, @Param('photoId') photoId: string) {
    return this.condition.deletePhoto(user, dealId, phase, photoId);
  }

  @Put(':dealId/:phase/odometer')
  setOdometer(@CurrentUser() user: AuthUser, @Param('dealId', ParseObjectIdPipe) dealId: string, @Param('phase', phasePipe) phase: Phase, @Body() dto: OdometerDto) {
    return this.condition.setOdometer(user, dealId, phase, dto.km);
  }
}
