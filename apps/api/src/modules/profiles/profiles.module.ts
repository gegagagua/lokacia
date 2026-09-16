import { Module } from '@nestjs/common';
import { ProfilesController, SeoController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { SeoService } from './seo.service';

/** Public broker/agency profiles (C12) and SEO landing/sitemap data (Phase 14). */
@Module({ controllers: [ProfilesController, SeoController], providers: [ProfilesService, SeoService], exports: [ProfilesService, SeoService] })
export class ProfilesModule {}
