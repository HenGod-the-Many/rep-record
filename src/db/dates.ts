/**
 * Local calendar dates as "YYYY-MM-DD" strings. All arithmetic goes through a
 * whole-day number computed in UTC, so daylight-saving changes and time zones
 * can never move a date by a day.
 */

const DAY_MS = 86_400_000;

export function toDayNum(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fromDayNum(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromDayNum(toDayNum(date) + days);
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return toDayNum(b) - toDayNum(a);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: string): number {
  return (((toDayNum(date) + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday
}

/** Today's date on the phone's own clock. */
export function todayLocal(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** The seven dates of the week containing `date`, starting on weekStart (0 = Sunday). */
export function weekDates(date: string, weekStart: number): string[] {
  const back = (weekday(date) - weekStart + 7) % 7;
  const first = addDays(date, -back);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** Whole weeks covering a month ("YYYY-MM"), for a calendar grid. */
export function monthGrid(month: string, weekStart: number): string[] {
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const start = weekDates(first, weekStart)[0];
  const lastWeekStart = weekDates(addDays(next, -1), weekStart)[0];
  const days = daysBetween(start, lastWeekStart) + 7;
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayName(day: number): string {
  return WEEKDAY_SHORT[day];
}

/** "Wed 18 Nov". */
export function formatDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${WEEKDAY_SHORT[weekday(date)]} ${d} ${MONTH[m - 1]}`;
}

/** "November 2026". */
export function formatMonth(month: string): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [y, m] = month.split('-').map(Number);
  return `${names[m - 1]} ${y}`;
}

/** Named parts of the day, with the clock time used to order them. */
export const TIME_SLOTS: { value: string; label: string; minutes: number }[] = [
  { value: 'morning', label: 'Morning', minutes: 8 * 60 },
  { value: 'noon', label: 'Noon', minutes: 12 * 60 },
  { value: 'evening', label: 'Evening', minutes: 18 * 60 },
  { value: 'night', label: 'Night', minutes: 21 * 60 },
];

export function isClockTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function timeSortKey(time: string): number {
  const slot = TIME_SLOTS.find((s) => s.value === time);
  if (slot) return slot.minutes;
  if (isClockTime(time)) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }
  return 24 * 60;
}

/** "Morning", or "6:15 am" for a custom time. */
export function timeLabel(time: string): string {
  const slot = TIME_SLOTS.find((s) => s.value === time);
  if (slot) return slot.label;
  if (isClockTime(time)) {
    const [h, m] = time.split(':').map(Number);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  }
  return time;
}
