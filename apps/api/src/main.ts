import './common/observability/register-api'; // no-op unless SENTRY_DSN / OTEL_EXPORTER_OTLP_ENDPOINT are set
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ENV, type Env } from './config/env';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));
  const env = app.get<Env>(ENV);
  configureApp(app, env);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));

  const doc = new DocumentBuilder()
    .setTitle('lokacia.ge API')
    .setDescription('Commercial space portal + broker CRM. Errors are RFC 9457 problem+json. Auth: httpOnly cookies (lk_at) or Bearer.')
    .setVersion('1.0')
    .addCookieAuth('lk_at')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'apiKey')
    .build();
  SwaggerModule.setup('v1/docs', app, SwaggerModule.createDocument(app, doc), { jsonDocumentUrl: 'v1/openapi.json' });

  await app.listen(env.PORT);
  app.get(Logger).log(`API on ${env.API_URL} (docs: /v1/docs)`);
}
void bootstrap();
void cookieParser;
