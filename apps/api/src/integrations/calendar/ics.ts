/** RFC 5545 calendar file (viewing invitations, P15). */
export function buildIcs(ev: { uid: string; start: Date; end: Date; title: string; description?: string; location?: string; url?: string }): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//lokacia.ge//viewings//KA',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${ev.uid}@lokacia.ge`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(ev.start)}`,
    `DTEND:${fmt(ev.end)}`,
    `SUMMARY:${esc(ev.title)}`,
    ev.description ? `DESCRIPTION:${esc(ev.description)}` : '',
    ev.location ? `LOCATION:${esc(ev.location)}` : '',
    ev.url ? `URL:${ev.url}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:ჩვენება 1 საათში',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n') + '\r\n';
}

export interface CalendarSync {
  readonly name: string;
  upsertEvent(userId: string, ev: { id: string; start: Date; end: Date; title: string; location?: string }): Promise<{ externalId: string }>;
}
export const CALENDAR = Symbol('CALENDAR');
export class MockCalendarSync implements CalendarSync {
  readonly name = 'mock';
  async upsertEvent(_userId: string, ev: { id: string }) {
    return { externalId: `gcal-mock-${ev.id}` };
  }
}
