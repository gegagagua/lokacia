import { Global, Module } from '@nestjs/common';
import { createAiClient } from '@lokacia/ai';
import { Logger } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { SMS } from './sms/sms';
import { MockSms } from './sms/sms.mock';
import { CHANNELS, type MessageChannel } from './channels/channels';
import { MockChannel } from './channels/channels.mock';
import { TelegramChannel, ViberChannel } from './channels/telegram';
import { ExpoPushChannel, MockPushChannel } from './channels/push';
import { PAYMENTS } from './payments/payments';
import { MockPayments } from './payments/payments.mock';
import { BogPayments, PspPayments, TbcPayments } from './payments/payments.banks';
import { STORAGE } from './storage/storage';
import { LocalStorage } from './storage/storage.local';
import { S3Storage } from './storage/storage.s3';
import { ESIGN, MockESign } from './esign/esign';
import { CALENDAR, MockCalendarSync } from './calendar/ics';
import { MockTraffic, TRAFFIC } from './traffic/traffic';
import { COMPETITORS, MockCompetitorChecker } from './competitors/competitors';

export const AI = Symbol('AI');

@Global()
@Module({
  providers: [
    { provide: SMS, inject: [ENV], useFactory: (_env: Env) => new MockSms() },
    {
      provide: CHANNELS,
      inject: [ENV],
      useFactory: (env: Env): Record<string, MessageChannel> => ({
        email: new MockChannel('email'),
        telegram: env.TELEGRAM_BOT_TOKEN ? new TelegramChannel(env.TELEGRAM_BOT_TOKEN) : new MockChannel('telegram'),
        viber: env.VIBER_BOT_TOKEN ? new ViberChannel(env.VIBER_BOT_TOKEN) : new MockChannel('viber'),
        whatsapp: new MockChannel('whatsapp'),
        push: env.PUSH_PROVIDER === 'expo' ? new ExpoPushChannel(env.EXPO_ACCESS_TOKEN) : new MockPushChannel(),
      }),
    },
    {
      provide: PAYMENTS,
      inject: [ENV],
      useFactory: (env: Env) => {
        switch (env.PAYMENTS_PROVIDER) {
          case 'bog':
            return new BogPayments(env.BOG_CLIENT_SECRET, env.PAYMENTS_WEBHOOK_SECRET);
          case 'tbc':
            return new TbcPayments(env.TBC_API_KEY, env.PAYMENTS_WEBHOOK_SECRET);
          case 'psp':
            return new PspPayments(env.PSP_API_KEY, env.PAYMENTS_WEBHOOK_SECRET);
          default:
            return new MockPayments(env.PAYMENTS_WEBHOOK_SECRET, env.APP_URL);
        }
      },
    },
    {
      provide: STORAGE,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.STORAGE_DRIVER === 's3'
          ? new S3Storage({ endpoint: env.S3_ENDPOINT, bucket: env.S3_BUCKET, accessKey: env.S3_ACCESS_KEY, secretKey: env.S3_SECRET_KEY })
          : new LocalStorage(env.STORAGE_DIR),
    },
    { provide: ESIGN, inject: [ENV], useFactory: (env: Env) => new MockESign(env.CRM_URL) },
    { provide: CALENDAR, useFactory: () => new MockCalendarSync() },
    { provide: TRAFFIC, useFactory: () => new MockTraffic() },
    { provide: COMPETITORS, useFactory: () => new MockCompetitorChecker() },
    {
      provide: AI,
      inject: [ENV],
      useFactory: (env: Env) => {
        const logger = new Logger('AI');
        return createAiClient(env, (u) => logger.log(`${u.purpose} ${u.model} in=${u.inputTokens} out=${u.outputTokens} ${u.ms}ms`));
      },
    },
  ],
  exports: [SMS, CHANNELS, PAYMENTS, STORAGE, ESIGN, CALENDAR, TRAFFIC, COMPETITORS, AI],
})
export class IntegrationsModule {}
