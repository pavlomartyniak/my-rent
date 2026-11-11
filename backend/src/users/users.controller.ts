import { Body, Controller, Get, NotFoundException, Patch } from '@nestjs/common';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { UpdateMeDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@CurrentUser() auth: AuthUser) {
    const user = await this.users.findById(auth.id);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return this.users.toPublic(user);
  }

  @Patch()
  async update(@CurrentUser() auth: AuthUser, @Body() dto: UpdateMeDto) {
    const user = await this.users.update(auth.id, dto);
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return this.users.toPublic(user);
  }
}
