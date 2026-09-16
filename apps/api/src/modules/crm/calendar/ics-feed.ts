/** Multi-event RFC 5545 feed (agent subscription URL, C4). Mirrors integrations/calendar/ics.ts escaping. */
export type IcsEvent = { uid: string; start: Date; end: Date; title: string; description?: string; location?: string; url?: string; cancelled?: boolean };

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function buildIcsFeed(name: string, events: IcsEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lokacia.ge//crm viewings//KA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:Asia/Tbilisi'];
  const now = fmt(new Date());
  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}@crm.lokacia.ge`,
      `DTSTAMP:${now}`,
      `DTSTART:${fmt(ev.start)}`,
      `DTEND:${fmt(ev.end)}`,
      `SUMMARY:${esc(ev.title)}`,
      ...(ev.description ? [`DESCRIPTION:${esc(ev.description)}`] : []),
      ...(ev.location ? [`LOCATION:${esc(ev.location)}`] : []),
      ...(ev.url ? [`URL:${ev.url}`] : []),
      `STATUS:${ev.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
