import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';

import { type AuthUser, CurrentUser, Roles } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { TerminateDealDto } from './deals.dto';
import { DealsService } from './deals.service';

/** Оренди орендаря: авто, які він взяв в оренду. Облік по них ведеться через /transactions і /reports/renter */
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Roles('renter')
  @Header('Cache-Control', 'no-store')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.deals.list(user.id);
  }

  /** Власник: поточна оренда мого авто (орендар, дати, ціна) або null */
  @Roles('owner')
  @Header('Cache-Control', 'no-store')
  @Get('car/:carId')
  async forCar(@CurrentUser() user: AuthUser, @Param('carId', ParseObjectIdPipe) carId: string) {
    // Порожня відповідь віддається як null у тілі, щоб клієнт відрізняв її від помилки
    return (await this.deals.activeForCar(user.id, carId)) ?? { none: true };
  }

  @Roles('renter')
  @Header('Cache-Control', 'no-store')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.get(user.id, id);
  }

  /** Запропонувати розірвати оренду достроково: може і власник, і орендар, але друга сторона має погодитись */
  @HttpCode(200)
  @Post(':id/terminate')
  propose(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: TerminateDealDto) {
    return this.deals.proposeTermination(user, id, dto.note);
  }

  /** Автор відкликає свою пропозицію */
  @HttpCode(200)
  @Post(':id/terminate/withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.withdrawTermination(user, id);
  }

  /** Друга сторона погоджується: оренду розірвано */
  @HttpCode(200)
  @Post(':id/terminate/accept')
  acceptTermination(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.acceptTermination(user, id);
  }

  /** Друга сторона відхиляє: оренда триває */
  @HttpCode(200)
  @Post(':id/terminate/decline')
  declineTermination(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.declineTermination(user, id);
  }
}
