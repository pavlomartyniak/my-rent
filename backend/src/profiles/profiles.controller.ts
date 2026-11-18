import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { CreateReviewDto } from './profiles.dto';
import { ProfilesService } from './profiles.service';

@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  /** Профіль користувача: рейтинг, статистика, контакти (лише стороні оренди), вільні авто власника */
  @Header('Cache-Control', 'no-store')
  @Get('users/:id/profile')
  profile(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.profiles.profile(user.id, id);
  }

  /** Чи можна оцінити другу сторону оренди, кого й за якими тегами */
  @Header('Cache-Control', 'no-store')
  @Get('reviews/deal/:dealId')
  state(@CurrentUser() user: AuthUser, @Param('dealId', ParseObjectIdPipe) dealId: string) {
    return this.profiles.reviewState(user.id, dealId);
  }

  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('reviews')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    return this.profiles.createReview(user.id, dto);
  }
}
