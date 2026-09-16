import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { ENV, type Env } from '../src/config/env';
import { QueueService } from '../src/common/queue.service';
import { DbService } from '../src/common/db.service';

export const PHONES = {
  admin: '+995500000001',
  moderator: '+995500000002',
  owner: '+995500000003',
  agencyManager: '+995500000004',
  agent: '+995500000005',
  tenant: '+995500000006',
  developer: '+995500000007',
  provider: '+995500000008',
  assistant: '+995500000009',
  agency2Manager: '+995500000010',
} as const;

export async function createApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true, logger: false });
  configureApp(app, app.get<Env>(ENV));
  await app.init();
  return { app, queue: app.get(QueueService), db: app.get(DbService).db, http: () => request(app.getHttpServer()) };
}

/** Logs in with the dev OTP code and returns a supertest agent carrying auth cookies. */
export async function loginAs(app: INestApplication, phone: string) {
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post('/v1/auth/otp/verify').send({ phone, code: '123456' });
  if (res.status !== 200) throw new Error(`login failed ${res.status} ${JSON.stringify(res.body)}`);
  return Object.assign(agent, { user: res.body.user as { id: string; orgs: { id: string; slug: string }[] } });
}
