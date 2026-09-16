import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';

/** Phase 15: feedback widget endpoint and privacy-friendly analytics events. Inbox lives in the admin module. */
@Module({ controllers: [FeedbackController] })
export class FeedbackModule {}
