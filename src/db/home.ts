import type { Session, WorkoutDB } from './db';
import { addDays, weekDates } from './dates';
import { getWeekStart, resolveRange } from './schedule';
import { liftingTotals, recentPrs, weekRange } from './stats';

/**
 * The Home screen's numbers (W-20, R-16.4). Definitions are in the W-20 spec.
 * "This week" follows the first-day-of-week setting.
 */

/** A workout left running counts at most this long. */
export const MAX_WORKOUT_MS = 4 * 60 * 60 * 1000;

/** Exercises that set a new record (heaviest weight or best estimated 1-rep max) this week, each counted once. */
export async function weekPrCount(db: WorkoutDB, today: string): Promise<number> {
  const { from, to } = await weekRange(db, today);
  const events = await recentPrs(db, Number.POSITIVE_INFINITY);
  return new Set(events.filter((e) => e.date >= from && e.date <= to).map((e) => e.exerciseId)).size;
}

/** Seconds of logged activities per workout. */
async function activitySecondsBySession(db: WorkoutDB, sessions: Session[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!sessions.length) return out;
  const activityIds = new Set((await db.exercises.toArray()).filter((e) => e.kind === 'activity').map((e) => e.id));
  for (const l of await db.setLogs.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray()) {
    if (!activityIds.has(l.exerciseId)) continue;
    out.set(l.sessionId, (out.get(l.sessionId) ?? 0) + (l.parts[0]?.seconds ?? 0));
  }
  return out;
}

/**
 * Minutes exercised this week. Each workout counts once: start to finish
 * (capped at 4 hours) if it was finished, or the time of its logged activities
 * if that is longer or it was never finished. Activities are logged inside a
 * workout, so adding both would count the same minutes twice.
 */
export async function minutesExercised(db: WorkoutDB, today: string): Promise<number> {
  const { from, to } = await weekRange(db, today);
  const sessions = await db.sessions.where('date').between(from, to, true, true).toArray();
  const activity = await activitySecondsBySession(db, sessions);
  let ms = 0;
  for (const s of sessions) {
    const timed = s.finishedAt !== null ? Math.min(Math.max(0, s.finishedAt - s.startedAt), MAX_WORKOUT_MS) : 0;
    ms += Math.max(timed, (activity.get(s.id) ?? 0) * 1000);
  }
  return Math.round(ms / 60_000);
}

/** Weeks in a row, ending this week or last week, with at least one finished workout or a logged activity. */
export async function weekStreak(db: WorkoutDB, today: string): Promise<number> {
  const weekStart = await getWeekStart(db);
  const startOf = (date: string) => weekDates(date, weekStart)[0];
  const sessions = await db.sessions.where('date').belowOrEqual(today).toArray();
  const activity = await activitySecondsBySession(db, sessions);
  const active = new Set(sessions.filter((s) => s.finishedAt !== null || activity.has(s.id)).map((s) => startOf(s.date)));
  let week = startOf(today);
  if (!active.has(week)) week = addDays(week, -7); // this week isn't over yet
  let n = 0;
  while (active.has(week)) {
    n++;
    week = addDays(week, -7);
  }
  return n;
}

/** This week's lifting volume (pounds), last week's, and the change in percent (null when last week had none). */
export async function weeklyVolume(db: WorkoutDB, today: string): Promise<{ volumeLb: number; lastWeekLb: number; changePct: number | null }> {
  const { from, to } = await weekRange(db, today);
  const volumeLb = (await liftingTotals(db, from, to)).volumeLb;
  const lastWeekLb = (await liftingTotals(db, addDays(from, -7), addDays(to, -7))).volumeLb;
  const changePct = lastWeekLb > 0 ? Math.round(((volumeLb - lastWeekLb) / lastWeekLb) * 100) : null;
  return { volumeLb, lastWeekLb, changePct };
}

/** Workouts finished this week out of workouts scheduled this week (programs and one-date changes); null if none scheduled. */
export async function planAdherence(db: WorkoutDB, today: string): Promise<{ done: number; scheduled: number } | null> {
  const { from, to } = await weekRange(db, today);
  const days = await resolveRange(db, from, addDays(to, 1));
  const scheduled = days.reduce((n, d) => n + d.workouts.length, 0);
  if (scheduled === 0) return null;
  const done = (await db.sessions.where('date').between(from, to, true, true).toArray()).filter((s) => s.finishedAt !== null).length;
  return { done, scheduled };
}
