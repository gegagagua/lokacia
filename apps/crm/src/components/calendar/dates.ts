import { MONTHS_KA } from '@lokacia/contracts';

export const WEEKDAYS_SHORT_KA = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Monday-first week start. */
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const timeHM = (iso: string | Date) => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const dayLabel = (d: Date) => `${d.getDate()} ${MONTHS_KA[d.getMonth()]}`;
export const monthLabel = (d: Date) => `${MONTHS_KA[d.getMonth()]} ${d.getFullYear()}`;

/** Local `YYYY-MM-DD` + `HH:MM` → ISO with the browser offset. */
export function localToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

/** Value for <input type="datetime-local">. */
export function toLocalInput(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${dayKey(d)}T${timeHM(d)}`;
}
