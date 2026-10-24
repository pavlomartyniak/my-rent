import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { type AuthUser, CurrentUser, Roles } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { CreateRentalDto, DeclineRentalDto } from './rentals.dto';
import { RentalsService } from './rentals.service';

@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentals: RentalsService) {}

  // ---- орендар ----

  /** Надіслати запит на оренду авто */
  @Roles('renter')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRentalDto) {
    return this.rentals.create(user.id, dto);
  }

  /** Мої запити */
  @Roles('renter')
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.rentals.mine(user.id);
  }

  @Roles('renter')
  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.rentals.cancel(user.id, id);
  }

  // ---- власник ----

  /** Вхідні запити на мої авто (`?status=pending|accepted|declined|cancelled`) */
  @Roles('owner')
  @Get('incoming')
  incoming(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.rentals.incoming(user.id, status);
  }

  /** Прийняти запит: авто автоматично стає «В оренді» з орендарем як водієм */
  @Roles('owner')
  @HttpCode(200)
  @Post(':id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.rentals.accept(user.id, id);
  }

  @Roles('owner')
  @HttpCode(200)
  @Post(':id/decline')
  decline(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: DeclineRentalDto) {
    return this.rentals.decline(user.id, id, dto.note);
  }
}
