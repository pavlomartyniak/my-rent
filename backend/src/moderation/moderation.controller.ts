import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { CreateBlockDto, CreateReportDto } from './moderation.dto';
import { ModerationService } from './moderation.service';

/** Скарги й блокування для будь-якого користувача (власника чи орендаря) */
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('reports')
  report(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.moderation.report(user, dto);
  }

  @Header('Cache-Control', 'no-store')
  @Get('blocks')
  blocks(@CurrentUser() user: AuthUser) {
    return this.moderation.listBlocks(user);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('blocks')
  block(@CurrentUser() user: AuthUser, @Body() dto: CreateBlockDto) {
    return this.moderation.block(user, dto);
  }

  @HttpCode(204)
  @Delete('blocks/:userId')
  unblock(@CurrentUser() user: AuthUser, @Param('userId', ParseObjectIdPipe) userId: string) {
    return this.moderation.unblock(user, userId);
  }
}
