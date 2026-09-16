import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AuditInterceptor } from './common/audit.interceptor';
import { CoreModule } from './common/core.module';
import { AuthGuard } from './common/guards/auth.guard';
import { ProblemFilter } from './common/problem';
import { HealthController } from './common/health.controller';
import { IntegrationsModule } from './integrations/integrations.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { SearchModule } from './modules/search/search.module';
import { GeoModule } from './modules/geo/geo.module';
import { ListingsModule } from './modules/listings/listings.module';
import { MediaModule } from './modules/media/media.module';
import { LivenessModule } from './modules/liveness/liveness.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { DemandModule } from './modules/demand/demand.module';
import { OffersModule } from './modules/offers/offers.module';
import { ViewingsModule } from './modules/viewings/viewings.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { StatsModule } from './modules/stats/stats.module';
import { ServicesModule } from './modules/services/services.module';
import { AiModule } from './modules/ai/ai.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { CrmModule } from './modules/crm/crm.module';
import { AdminModule } from './modules/admin/admin.module';
import { BillingModule } from './modules/billing/billing.module';
import { V2Module } from './modules/v2/v2.module';
import { FeedbackModule } from './modules/feedback/feedback.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
        genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
        redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-api-key"]', 'req.headers["x-signature"]', 'res.headers["set-cookie"]'],
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true, ignore: 'pid,hostname,req.headers,res.headers' } } : undefined,
        autoLogging: { ignore: (req) => req.url?.startsWith('/v1/media/placeholder') ?? false },
      },
    }),
    CoreModule,
    IntegrationsModule,
    NotificationsModule,
    TaxonomyModule,
    SearchModule,
    GeoModule,
    ListingsModule,
    MediaModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    LivenessModule,
    AlertsModule,
    FavoritesModule,
    DemandModule,
    OffersModule,
    ViewingsModule,
    MessagingModule,
    StatsModule,
    ServicesModule,
    AiModule,
    ProjectsModule,
    ProfilesModule,
    CrmModule,
    AdminModule,
    BillingModule,
    V2Module,
    FeedbackModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ProblemFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
