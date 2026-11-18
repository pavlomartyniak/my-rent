import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { MessagesQuery, OpenChatDto, SendMessageDto } from './chat.dto';
import { ChatService } from './chat.service';

/** Чати власників і орендарів: ті самі маршрути для обох ролей, сервер сам визначає сторону */
@Controller('chats')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Header('Cache-Control', 'no-store')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.chat.list(user);
  }

  @Header('Cache-Control', 'no-store')
  @Get('unread')
  unread(@CurrentUser() user: AuthUser) {
    return this.chat.unreadTotal(user);
  }

  /** Відкрити (або створити) чат у контексті запиту, пропозиції чи оренди */
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post()
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenChatDto) {
    return this.chat.open(user, dto);
  }

  @Header('Cache-Control', 'no-store')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.chat.get(user, id);
  }

  @Header('Cache-Control', 'no-store')
  @Get(':id/messages')
  messages(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Query() { before, limit }: MessagesQuery) {
    return this.chat.history(user, id, before, limit);
  }

  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post(':id/messages')
  send(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: SendMessageDto) {
    return this.chat.send(user, id, dto.text, dto.clientId);
  }

  /** Видалити розмову зі свого списку (співрозмовник її зберігає) */
  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.chat.remove(user, id);
  }

  @HttpCode(204)
  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.chat.markRead(user, id);
  }
}
