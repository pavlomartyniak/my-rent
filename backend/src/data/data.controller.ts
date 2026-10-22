import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { ImportDto } from './data.dto';
import { DataService } from './data.service';

@Controller()
export class DataController {
  constructor(private readonly data: DataService) {}

  @Get('data')
  all(@CurrentUser() user: AuthUser) {
    return this.data.all(user.id);
  }

  @Post('data/import')
  import(@CurrentUser() user: AuthUser, @Body() dto: ImportDto) {
    return this.data.replaceAll(user.id, dto);
  }

  @HttpCode(204)
  @Delete('data')
  async clear(@CurrentUser() user: AuthUser) {
    await this.data.clear(user.id);
  }

  @HttpCode(204)
  @Delete('me')
  deleteAccount(@CurrentUser() user: AuthUser) {
    return this.data.deleteAccount(user.id);
  }
}
