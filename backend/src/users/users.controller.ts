import { Body, Controller, ForbiddenException, Get, NotFoundException, Patch } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { UpdateMeDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async me(@CurrentUser() auth: AuthUser) {
    const user = await this.users.findById(auth.id);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return this.users.toPublic(user);
  }

  @Patch()
  async update(@CurrentUser() auth: AuthUser, @Body() dto: UpdateMeDto) {
    // Поки немає оплати, тариф Pro перемикається лише в демо-режимі
    if (dto.isPro !== undefined && this.config.get('DEMO_MODE') !== 'true') {
      throw new ForbiddenException('Зміна тарифу недоступна');
    }
    const user = await this.users.update(auth.id, dto);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return this.users.toPublic(user);
  }
}
