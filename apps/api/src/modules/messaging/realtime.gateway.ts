import { Logger, OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ACCESS_COOKIE, TokensService } from '../../common/tokens.service';
import { NotificationsService } from '../notifications/notifications.service';

function cookieValue(header: string | undefined, name: string) {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

const origins = [process.env.APP_URL ?? 'http://localhost:3100', process.env.CRM_URL ?? 'http://localhost:3101', process.env.ADMIN_URL ?? 'http://localhost:3102'];

/**
 * WebSocket gateway (`/v1/ws`, socket.io). Authenticates from the `lk_at` cookie or `auth.token`,
 * joins `user:<id>` room, pushes chat messages, read receipts and in-app notifications.
 */
@WebSocketGateway({ namespace: '/v1/ws', cors: { origin: origins, credentials: true }, transports: ['websocket', 'polling'] })
export class RealtimeGateway implements OnGatewayConnection, OnModuleInit {
  private readonly logger = new Logger('Realtime');
  @WebSocketServer() server?: Server;

  constructor(
    private readonly tokens: TokensService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.notifications.onInApp((n) => this.toUser(n.userId, 'notification', n));
  }

  handleConnection(client: Socket) {
    const auth = client.handshake.auth as { token?: string } | undefined;
    const raw = auth?.token ?? cookieValue(client.handshake.headers.cookie, ACCESS_COOKIE);
    const payload = raw ? this.tokens.verifyAccess(raw) : null;
    if (!payload) {
      client.emit('unauthorized');
      client.disconnect(true);
      return;
    }
    (client.data as { userId?: string }).userId = payload.sub;
    void client.join(`user:${payload.sub}`);
    client.emit('ready', { userId: payload.sub });
  }

  toUser(userId: string, event: string, payload: unknown) {
    try {
      this.server?.to(`user:${userId}`).emit(event, payload);
    } catch (e) {
      this.logger.warn(`emit ${event} failed: ${(e as Error).message}`);
    }
  }
}
