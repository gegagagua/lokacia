import { Mail, MessageSquare, Send, type LucideIcon } from 'lucide-react';
import type { CrmSequence } from '@lokacia/contracts';
import type { Tone } from '@/components/common/ui';

/** Channel icon + categorical tone shared by the sequence list and the step builder. */
export const CHANNEL_META: Record<CrmSequence['steps'][number]['channel'], { icon: LucideIcon; tone: Tone }> = {
  sms: { icon: MessageSquare, tone: 2 },
  email: { icon: Mail, tone: 7 },
  telegram: { icon: Send, tone: 6 },
};
