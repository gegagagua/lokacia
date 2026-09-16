import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export type Paginated<T> = { items: T[]; nextCursor: string | null; total?: number };

/** RFC 9457 problem details. */
export type Problem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: { path: string; message: string }[];
};

export const ROLES = [
  'guest',
  'user',
  'broker',
  'agency_manager',
  'agency_assistant',
  'developer',
  'moderator',
  'admin',
] as const;
export type Role = (typeof ROLES)[number];

export const ORG_ROLES = ['manager', 'agent', 'assistant'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Normalize a Georgian phone number to E.164 (+995XXXXXXXXX). Returns null when impossible. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  let d = digits.startsWith('+') ? digits.slice(1) : digits;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('5')) d = `995${d}`;
  if (d.length === 10 && d.startsWith('0')) d = `995${d.slice(1)}`;
  if (!/^\d{11,15}$/.test(d)) return null;
  return `+${d}`;
}

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'ტელეფონის ნომერი არასწორია' });
      return z.NEVER;
    }
    return n;
  });

/** Encode/decode opaque cursors: base64url JSON. */
export function encodeCursor(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeCursor<T>(cursor: string | undefined | null): T | null {
  if (!cursor) return null;
  try {
    const bin = atob(cursor.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}
