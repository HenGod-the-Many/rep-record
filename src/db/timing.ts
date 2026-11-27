import type { ExerciseKind, Pause, Session, SetLog } from './db';

/**
 * The timing model (W-25, R-17.2 to R-17.5). Pure functions over a workout and
 * its sets, so the same code times a workout on the phone and a backup file in
 * scripts/timing-report.mjs. Only type imports here: keep it that way, so Node
 * can run this file as it is.
 *
 * Rules (approved answers in the W-25 spec):
 * - Each set is given the time since the previous tick in the workout, with
 *   paused time taken out, and at most 5 minutes.
 * - The first set of an exercise in a workout gets 3 s per rep (a timed set: its
 *   own seconds), counted back from its tick, when that is shorter.
 * - An activity counts its own logged duration (it is typed in, not ticked live).
 * - An exercise's time is the sum of its sets' times.
 * - A workout runs from Start to its last tick (no ticks: to Finish), pauses
 *   taken out; a stretch between two ticks counts at most 15 minutes;
 *   at most 4 hours. Logged activities are never cut.
 */

export const SECONDS_PER_REP = 3;
/** Longest time one set can be given (answer 2). */
export const MAX_SET_MS = 5 * 60 * 1000;
/** A stretch between two ticks counts at most this long toward the workout (Taylor, 2026-11-27, answer 9). */
export const MAX_GAP_MS = 15 * 60 * 1000;
/** A workout counts at most this long. */
export const MAX_WORKOUT_MS = 4 * 60 * 60 * 1000;
/** Averages are over this many most recent times (answer 5). */
export const AVERAGE_OF = 5;

export type TimedSession = Pick<Session, 'startedAt' | 'finishedAt'> & { pauses?: Pause[] };
export type TimedSet = Pick<SetLog, 'id' | 'exerciseId' | 'parts' | 'loggedAt'>;
export type KindOf = (exerciseId: string) => ExerciseKind;

/** Paused time between `from` and `to`. A pause not yet resumed runs to `to`. */
export function pausedMs(pauses: Pause[] | undefined, from: number, to: number): number {
  let ms = 0;
  for (const p of pauses ?? []) {
    const a = Math.max(p.from, from);
    const b = Math.min(p.to ?? to, to);
    if (b > a) ms += b - a;
  }
  return ms;
}

const byTick = (sets: TimedSet[]) => [...sets].sort((a, b) => a.loggedAt - b.loggedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** How long the set itself takes by its numbers: 3 s per rep, or its own seconds for a timed set or activity. */
export function ownMs(set: TimedSet, kind: ExerciseKind): number {
  if (kind === 'timed' || kind === 'activity') return set.parts.reduce((n, p) => n + (p.seconds ?? 0), 0) * 1000;
  return set.parts.reduce((n, p) => n + (p.reps ?? 0), 0) * SECONDS_PER_REP * 1000;
}

/** When the workout's clock started. Very old workouts may have no start time; they start at their first set. */
function startOf(session: TimedSession, ordered: TimedSet[], kindOf: KindOf): number {
  if (session.startedAt > 0 || !ordered.length) return session.startedAt;
  return ordered[0].loggedAt - ownMs(ordered[0], kindOf(ordered[0].exerciseId));
}

/** Time given to each set, by set id. */
export function setTimes(session: TimedSession, sets: TimedSet[], kindOf: KindOf): Map<string, number> {
  const out = new Map<string, number>();
  const ordered = byTick(sets);
  const seen = new Set<string>();
  let prev = startOf(session, ordered, kindOf);
  for (const s of ordered) {
    const kind = kindOf(s.exerciseId);
    const gap = Math.max(0, s.loggedAt - prev - pausedMs(session.pauses, prev, s.loggedAt));
    let ms: number;
    if (kind === 'activity') ms = ownMs(s, kind);
    else {
      ms = Math.min(gap, MAX_SET_MS);
      if (!seen.has(s.exerciseId)) ms = Math.min(ms, ownMs(s, kind));
    }
    seen.add(s.exerciseId);
    out.set(s.id, ms);
    prev = Math.max(prev, s.loggedAt);
  }
  return out;
}

/** Time per exercise in this workout, by exercise id. */
export function exerciseTimes(session: TimedSession, sets: TimedSet[], kindOf: KindOf): Map<string, number> {
  const perSet = setTimes(session, sets, kindOf);
  const out = new Map<string, number>();
  for (const s of sets) out.set(s.exerciseId, (out.get(s.exerciseId) ?? 0) + (perSet.get(s.id) ?? 0));
  return out;
}

/** When the workout ended: its last tick, or Finish if nothing was ticked; null while open with no ticks. */
export function workoutEnd(session: TimedSession, sets: TimedSet[]): number | null {
  if (sets.length) return Math.max(...sets.map((s) => s.loggedAt));
  return session.finishedAt;
}

/** Start to `end` with pauses taken out, at most 4 hours. */
export function elapsedMs(session: TimedSession, end: number, start = session.startedAt): number {
  return Math.min(Math.max(0, end - start - pausedMs(session.pauses, start, end)), MAX_WORKOUT_MS);
}

/**
 * The workout's timed duration: Start to its end, pauses taken out, at most 4
 * hours. A stretch between two ticks counts at most 15 minutes (a forgotten
 * tick caught up later); the time from Start to the first tick is not limited.
 */
export function workoutMs(session: TimedSession, sets: TimedSet[], kindOf: KindOf = () => 'weight'): number {
  const end = workoutEnd(session, sets);
  if (end === null) return 0;
  const ordered = byTick(sets);
  const start = startOf(session, ordered, kindOf);
  if (!ordered.length) return elapsedMs(session, end, start);
  let ms = elapsedMs(session, ordered[0].loggedAt, start);
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1].loggedAt;
    const b = ordered[i].loggedAt;
    // The stretch before an activity's tick holds the activity, plus up to 15 minutes like any other.
    const kind = kindOf(ordered[i].exerciseId);
    const limit = kind === 'activity' ? MAX_GAP_MS + ownMs(ordered[i], kind) : MAX_GAP_MS;
    ms += Math.min(Math.max(0, b - a - pausedMs(session.pauses, a, b)), limit);
  }
  return Math.min(ms, MAX_WORKOUT_MS);
}

/** Logged activity time in the workout. */
export function activityMs(sets: TimedSet[], kindOf: KindOf): number {
  return sets.filter((s) => kindOf(s.exerciseId) === 'activity').reduce((n, s) => n + ownMs(s, 'activity'), 0);
}

/**
 * What the workout adds to minutes exercised (R-17.5): its timed duration. An
 * activity logged in it is inside that time (the longer of the two counts, for an
 * activity typed in longer than the clock ran). An activity-only workout that was
 * never finished counts its logged activity time.
 */
export function countedMs(session: TimedSession, sets: TimedSet[], kindOf: KindOf): number {
  const activity = activityMs(sets, kindOf);
  const activityOnly = sets.length > 0 && sets.every((s) => kindOf(s.exerciseId) === 'activity');
  if (activityOnly && session.finishedAt === null) return activity;
  return Math.max(workoutMs(session, sets, kindOf), activity);
}

/** Mean of the most recent 5 times (newest first), leaving out zeros; null when there are none. */
export function averageMs(newestFirst: number[]): number | null {
  const recent = newestFirst.filter((ms) => ms > 0).slice(0, AVERAGE_OF);
  if (!recent.length) return null;
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}
