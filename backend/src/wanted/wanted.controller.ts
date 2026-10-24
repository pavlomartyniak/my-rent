import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { type AuthUser, CurrentUser, Roles } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { CreateOfferDto, DeclineOfferDto } from '../offers/offers.dto';
import { OffersService } from '../offers/offers.service';
import { BoardQuery, CreateWantedDto } from './wanted.dto';
import { WantedService } from './wanted.service';

/** Заявки орендарів («шукаю таке авто») і пропозиції власників */
@Controller()
export class WantedController {
  constructor(
    private readonly wanted: WantedService,
    private readonly offers: OffersService,
  ) {}

  // ---- орендар ----

  @Roles('renter')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('wanted')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWantedDto) {
    return this.wanted.create(user.id, dto);
  }

  @Roles('renter')
  @Header('Cache-Control', 'no-store')
  @Get('wanted/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.wanted.mine(user.id);
  }

  @Roles('renter')
  @HttpCode(200)
  @Post('wanted/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.wanted.cancel(user.id, id);
  }

  @Roles('renter')
  @HttpCode(204)
  @Delete('wanted/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.wanted.remove(user.id, id);
  }

  /** Пропозиції на мою заявку */
  @Roles('renter')
  @Header('Cache-Control', 'no-store')
  @Get('wanted/:id/offers')
  offersFor(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.offers.forWanted(user.id, id);
  }

  @Roles('renter')
  @HttpCode(200)
  @Post('offers/:id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.offers.accept(user.id, id);
  }

  @Roles('renter')
  @HttpCode(200)
  @Post('offers/:id/decline')
  decline(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: DeclineOfferDto) {
    return this.offers.decline(user.id, id, dto.note);
  }

  // ---- власник ----

  /** Дошка відкритих заявок орендарів */
  @Roles('owner')
  @Header('Cache-Control', 'no-store')
  @Get('wanted')
  board(@CurrentUser() user: AuthUser, @Query() query: BoardQuery) {
    return this.wanted.board(user.id, query);
  }

  @Roles('owner')
  @Header('Cache-Control', 'no-store')
  @Get('wanted/:id')
  one(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.wanted.getForOwner(user.id, id);
  }

  /** Запропонувати своє вільне авто на заявку */
  @Roles('owner')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('wanted/:id/offers')
  offer(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: CreateOfferDto) {
    return this.offers.create(user.id, id, dto);
  }

  @Roles('owner')
  @Header('Cache-Control', 'no-store')
  @Get('offers/mine')
  myOffers(@CurrentUser() user: AuthUser) {
    return this.offers.mine(user.id);
  }

  @Roles('owner')
  @HttpCode(200)
  @Post('offers/:id/withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.offers.withdraw(user.id, id);
  }
}
