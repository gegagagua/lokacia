import { z } from 'zod';

/** CRM contracts — unified inbox (C6). */

export const INBOX_CHANNELS = ['portal', 'whatsapp', 'viber', 'telegram'] as const;
export type InboxChannel = (typeof INBOX_CHANNELS)[number];
export const INBOX_CHANNEL_LABELS: Record<InboxChannel, string> = { portal: 'lokacia.ge', whatsapp: 'WhatsApp', viber: 'Viber', telegram: 'Telegram' };

export const inboxWebhookSchema = z.object({
  orgId: z.string().uuid(),
  from: z.string().trim().min(1).max(80),
  name: z.string().trim().max(120).optional(),
  text: z.string().trim().min(1).max(4000),
});
export type InboxWebhook = z.infer<typeof inboxWebhookSchema>;

export const inboxSimulateSchema = z.object({
  channel: z.enum(['whatsapp', 'viber', 'telegram']).default('whatsapp'),
  from: z.string().trim().min(1).max(80),
  name: z.string().trim().max(120).optional(),
  text: z.string().trim().min(1).max(4000),
});

export const inboxReplySchema = z.object({ body: z.string().trim().min(1).max(4000) });
export const inboxLinkSchema = z.object({ contactId: z.string().uuid().nullable() });

export type InboxConversation = {
  id: string;
  channel: InboxChannel;
  subject: string | null;
  externalId: string | null;
  listingId: string | null;
  listingTitle: string | null;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  counterpart: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: number;
};

export type InboxMessage = { id: string; body: string; direction: 'in' | 'out'; senderId: string | null; senderName: string | null; externalSender: string | null; createdAt: string; readAt: string | null };
