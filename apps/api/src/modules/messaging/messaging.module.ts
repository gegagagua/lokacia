import { Global, Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { RealtimeGateway } from './realtime.gateway';

@Global()
@Module({ controllers: [MessagingController], providers: [MessagingService, RealtimeGateway], exports: [MessagingService, RealtimeGateway] })
export class MessagingModule {}
