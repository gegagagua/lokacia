import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ENV, loadEnv } from '../config/env';
import { DbService } from './db.service';
import { QueueService } from './queue.service';
import { RateLimitService, RedisService } from './redis.service';
import { SettingsService } from './settings.service';
import { TokensService } from './tokens.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [{ provide: ENV, useFactory: () => loadEnv() }, DbService, TokensService, RedisService, RateLimitService, QueueService, SettingsService],
  exports: [ENV, DbService, TokensService, RedisService, RateLimitService, QueueService, SettingsService, JwtModule],
})
export class CoreModule {}
