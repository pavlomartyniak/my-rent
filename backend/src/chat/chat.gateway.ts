import { Logger, type OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { RealtimeService } from '../realtime/realtime.service';
import type { Server, Socket } from 'socket.io';

import type { Role } from '../common/constants';
import type { ChatService } from './chat.service';

export const userRoom = (userId: string) => `user:${userId}`;

type Typing = { conversationId?: unknown };

/**
 * Живий канал для чатів. Усі записи йдуть через REST (надійно, з підтвердженням), а сокет лише доставляє
 * події співрозмовнику й іншим пристроям користувача: нове повідомлення, «прочитано», «друкує…».
 */
@WebSocketGateway({ cors: false, pingInterval: 25_000, pingTimeout: 20_000, maxHttpBufferSize: 10_000 })
export class ChatGateway implements OnGatewayConnection, OnModuleInit {
  private readonly log = new Logger(ChatGateway.name);
  @WebSocketServer() private server!: Server;
  /** Підключається ChatService після створення (щоб уникнути циклічної залежності) */
  chat?: ChatService;

  constructor(
    private readonly jwt: JwtService,
    private readonly realtime: RealtimeService,
  ) {}

  onModuleInit() {
    this.realtime.attach((ids, event, payload) => this.emitTo(ids, event, payload));
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    try {
      if (typeof token !== 'string') throw new Error('no token');
      const payload = await this.jwt.verifyAsync<{ sub: string; role?: Role }>(token);
      const user = { id: payload.sub, role: payload.role ?? ('owner' as Role) };
      client.data.user = user;
      await client.join(userRoom(user.id));
    } catch {
      client.disconnect(true);
      return;
    }

    // «Друкує…» обробляється тут, а не через @SubscribeMessage: глобальні guard-и HTTP до сокетів не стосуються
    let last = 0;
    client.on('typing', (payload: Typing) => {
      const now = Date.now();
      if (now - last < 1500 || typeof payload?.conversationId !== 'string') return;
      last = now;
      void this.chat?.notifyTyping(client.data.user.id, payload.conversationId).catch((e) => this.log.debug(String(e)));
    });
  }

  emitTo(userIds: string[], event: string, payload: unknown) {
    for (const id of new Set(userIds)) this.server.to(userRoom(id)).emit(event, payload);
  }
}
