import { Module } from '@nestjs/common';
import { ListingPrebookController, ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

/** Off-plan projects & pre-booking (P8). */
@Module({ controllers: [ProjectsController, ListingPrebookController], providers: [ProjectsService], exports: [ProjectsService] })
export class ProjectsModule {}
