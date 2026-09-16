import { Module } from '@nestjs/common';
import { CrmTasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

/** CRM submodule: tasks & reminders (C5). */
@Module({ controllers: [CrmTasksController], providers: [TasksService], exports: [TasksService] })
export class CrmTasksModule {}
