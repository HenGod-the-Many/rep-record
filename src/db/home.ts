import type { Session, WorkoutDB } from './db';
import { addDays, weekDates } from './dates';
import { getWeekStart, resolveRange } from './schedule';
import { liftingTotals, recentPrs, weekRange, type PrEvent } from './stats';
import { countedMs } from './timing';

/**
 * The Home screen's numbers (W-20, R-16.4). Definitions are in the W-20 spec.
 * "This week" follows the first-day-of-week setting.
 */

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
 * How long each workout counts for (W-25, R-17.5): its timed duration from the
 * timing model (Start to the last tick, pauses out, 15 minutes at most between
 * ticks). An activity logged in a workout is inside that time; an activity-only
 * workout never finished counts its logged activity time.
 */
async function countedBySession(db: WorkoutDB, sessions: Session[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!sessions.length) return out;
  const kinds = new Map((await db.exercises.toArray()).map((e) => [e.id, e.kind]));
  const kindOf = (id: string) => kinds.get(id) ?? 'weight';
  const logs = await db.setLogs.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray();
  for (const s of sessions) out.set(s.id, countedMs(s, logs.filter((l) => l.sessionId === s.id), kindOf));
  return out;
}

/** Minutes exercised this week: the timed duration of each workout (R-17.5). */
export async function minutesExercised(db: WorkoutDB, today: string): Promise<number> {
  const { from, to } = await weekRange(db, today);
  const sessions = await db.sessions.where('date').between(from, to, true, true).toArray();
  const counted = await countedBySession(db, sessions);
  let ms = 0;
  for (const s of sessions) ms += counted.get(s.id) ?? 0;
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

// ---------- Progress: this week in detail (slice 4) ----------

export interface WeekWorkout {
  sessionId: string;
  date: string;
  name: string;
  minutes: number;
  /** False for a workout that was never finished (it still counts its timed duration). */
  finished: boolean;
}

/**
 * This week's workouts that count toward minutes exercised (any with a timed
 * duration), newest first. The minutes add up to minutesExercised.
 */
export async function weekWorkouts(db: WorkoutDB, today: string): Promise<WeekWorkout[]> {
  const { from, to } = await weekRange(db, today);
  const all = await db.sessions.where('date').between(from, to, true, true).toArray();
  const counted = await countedBySession(db, all);
  return all
    .filter((s) => (counted.get(s.id) ?? 0) > 0)
    .sort((a, b) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1))
    .map((s) => ({
      sessionId: s.id,
      date: s.date,
      name: s.planName,
      minutes: Math.round((counted.get(s.id) ?? 0) / 60_000),
      finished: s.finishedAt !== null,
    }));
}

/** This week's new records, one per exercise (the heaviest-weight record when it set both), newest first. */
export async function weekPrs(db: WorkoutDB, today: string): Promise<PrEvent[]> {
  const { from, to } = await weekRange(db, today);
  const best = new Map<string, PrEvent>();
  for (const e of await recentPrs(db, Number.POSITIVE_INFINITY)) {
    if (e.date < from || e.date > to) continue;
    const had = best.get(e.exerciseId);
    if (!had || (had.record === 'e1rm' && e.record === 'heaviest' && e.date === had.date) || e.date > had.date) best.set(e.exerciseId, e);
  }
  return [...best.values()].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}

export interface RecentExercise {
  exerciseId: string;
  name: string;
  lastDate: string;
}

/** Exercises with logged sets, most recently done first (history follows the exercise, archived or not). */
export async function recentExercises(db: WorkoutDB, limit: number): Promise<RecentExercise[]> {
  const dates = new Map((await db.sessions.toArray()).map((s) => [s.id, s.date]));
  const last = new Map<string, string>();
  for (const l of await db.setLogs.toArray()) {
    const d = dates.get(l.sessionId);
    if (d && (!last.has(l.exerciseId) || d > last.get(l.exerciseId)!)) last.set(l.exerciseId, d);
  }
  const names = new Map((await db.exercises.toArray()).map((e) => [e.id, e.name]));
  return [...last.entries()]
    .filter(([id]) => names.has(id))
    .sort(([, a], [, b]) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, limit)
    .map(([exerciseId, lastDate]) => ({ exerciseId, name: names.get(exerciseId)!, lastDate }));
}
