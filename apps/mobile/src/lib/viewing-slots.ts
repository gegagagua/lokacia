/** Candidate times when the owner published no slots: next `days` days (from tomorrow), 10:00–18:00 hourly, local time. */
export function candidateDays(now: Date, days = 7): Date[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i + 1);
    return d;
  });
}

export const CANDIDATE_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

export function atHour(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export function hhmm(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
}
