import type { WorkoutDB } from './db';
import { loadCalendar, resolveFrom } from './schedule';

/**
 * How a calendar day looks (W-20, R-16.7):
 * - done: at least one workout finished that day
 * - planned: workouts planned, today or later, none finished yet
 * - missed: workouts planned on a past day and none finished
 * - rest: a planned rest day (a program's rest day, or a day cleared by hand)
 * - none: nothing scheduled
 */
export type DayStatus = 'done' | 'planned' | 'missed' | 'rest' | 'none';

export async function dayStatuses(db: WorkoutDB, dates: string[], today: string): Promise<Record<string, DayStatus>> {
  if (dates.length === 0) return {};
  const sorted = [...dates].sort();
  const cal = await loadCalendar(db);
  const finished = new Set(
    (await db.sessions.where('date').between(sorted[0], sorted[sorted.length - 1], true, true).toArray())
      .filter((s) => s.finishedAt !== null)
      .map((s) => s.date),
  );
  const out: Record<string, DayStatus> = {};
  for (const date of dates) {
    const day = resolveFrom(cal, date);
    if (finished.has(date)) out[date] = 'done';
    else if (day.workouts.length > 0) out[date] = date < today ? 'missed' : 'planned';
    else out[date] = day.scheduled || day.overridden ? 'rest' : 'none';
  }
  return out;
}
