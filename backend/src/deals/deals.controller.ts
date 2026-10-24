import { Controller, Get, Header, Param } from '@nestjs/common';

import { type AuthUser, CurrentUser, Roles } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { DealsService } from './deals.service';

/** Оренди орендаря: авто, які він взяв в оренду. Облік по них ведеться через /transactions і /reports/renter */
@Roles('renter')
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Header('Cache-Control', 'no-store')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.deals.list(user.id);
  }

  @Header('Cache-Control', 'no-store')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.get(user.id, id);
  }
}
