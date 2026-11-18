import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { MAX_CHAT_FILE_BYTES } from './chat-files';
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

  /** Завантажити файл у розмову (поле форми `file`, до 10 МБ); повертає fileId для надсилання разом із повідомленням */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_CHAT_FILE_BYTES, files: 1 } }))
  @Post(':id/files')
  uploadFile(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @UploadedFile() file: { originalname: string; size: number; buffer: Buffer } | undefined) {
    return this.chat.uploadFile(user, id, file);
  }

  /** Файл із розмови для завантаження (лише учасникам) */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Get(':id/files/:fileId')
  async file(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Param('fileId', ParseObjectIdPipe) fileId: string) {
    const f = await this.chat.downloadFile(user, id, fileId);
    return new StreamableFile(f.data, { type: f.mime, disposition: `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}` });
  }

  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post(':id/messages')
  send(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: SendMessageDto) {
    return this.chat.send(user, id, dto.text ?? '', dto.clientId, dto.attachments);
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
