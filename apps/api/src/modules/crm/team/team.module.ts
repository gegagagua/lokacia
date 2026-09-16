import { Module } from '@nestjs/common';
import { LeadDistributionService } from './lead-distribution.service';
import { TeamController } from './team.controller';

/** C17 team, permissions, lead distribution. */
@Module({ controllers: [TeamController], providers: [LeadDistributionService], exports: [LeadDistributionService] })
export class CrmTeamModule {}
