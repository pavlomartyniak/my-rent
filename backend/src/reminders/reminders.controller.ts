import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';

import { type AuthUser, CurrentUser, Roles } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { CreateReminderDto, UpdateReminderDto } from './reminders.dto';
import { RemindersService } from './reminders.service';

@Roles('owner')
@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.reminders.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReminderDto) {
    return this.reminders.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateReminderDto) {
    return this.reminders.update(user.id, id, dto);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.reminders.remove(user.id, id);
  }
}
