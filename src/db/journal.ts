import type { DayNote, WorkoutDB } from './db';
import { ValidationError } from './errors';

/** Journal (W-09): a free-text note on each workout, and a day note with three 1–5 ratings. */

export type Rating = 'energy' | 'sleep' | 'soreness';
export const RATINGS: Rating[] = ['energy', 'sleep', 'soreness'];

export async function setSessionNote(db: WorkoutDB, sessionId: string, text: string): Promise<void> {
  const n = await db.sessions.update(sessionId, { journalNote: text });
  if (n === 0 && !(await db.sessions.get(sessionId))) throw new ValidationError('That workout no longer exists.');
}

export function emptyDayNote(date: string): DayNote {
  return { date, energy: null, sleep: null, soreness: null, note: '' };
}

export async function getDayNote(db: WorkoutDB, date: string): Promise<DayNote> {
  return (await db.dayNotes.get(date)) ?? emptyDayNote(date);
}

const isEmpty = (d: DayNote) => d.energy === null && d.sleep === null && d.soreness === null && d.note.trim() === '';

/**
 * Change part of a day's note. A note left with nothing in it is removed, so
 * the calendar only marks days that really have one.
 */
export async function saveDayNote(db: WorkoutDB, date: string, patch: Partial<Omit<DayNote, 'date'>>): Promise<void> {
  for (const r of RATINGS) {
    const v = patch[r];
    if (v !== undefined && v !== null && !(Number.isInteger(v) && v >= 1 && v <= 5)) {
      throw new ValidationError('Ratings go from 1 to 5.');
    }
  }
  await db.transaction('rw', db.dayNotes, async () => {
    const next = { ...(await getDayNote(db, date)), ...patch, date };
    if (isEmpty(next)) await db.dayNotes.delete(date);
    else await db.dayNotes.put(next);
  });
}

/**
 * One tap on a rating number, read and written in one transaction so two quick
 * taps on the same number set it and then clear it.
 */
export async function tapDayRating(db: WorkoutDB, date: string, rating: Rating, n: number): Promise<void> {
  await db.transaction('rw', db.dayNotes, async () => {
    const current = (await getDayNote(db, date))[rating];
    await saveDayNote(db, date, { [rating]: nextRating(current, n) });
  });
}

/** Tapping the chosen number again clears it. */
export function nextRating(current: number | null, tapped: number): number | null {
  return current === tapped ? null : tapped;
}

/** Of the given dates, those with a day note or a workout note. */
export async function datesWithNotes(db: WorkoutDB, dates: string[]): Promise<Set<string>> {
  if (dates.length === 0) return new Set();
  const out = new Set<string>();
  for (const d of await db.dayNotes.where('date').anyOf(dates).toArray()) out.add(d.date);
  for (const s of await db.sessions.where('date').anyOf(dates).toArray()) {
    if (s.journalNote.trim()) out.add(s.date);
  }
  return out;
}
