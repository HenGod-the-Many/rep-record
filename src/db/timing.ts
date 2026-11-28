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

/**
 * What the workout timer shows at `now` (R-17.1, R-17.2). Stopped (every target
 * set ticked, or the workout finished): the workout's time, which ends at its
 * last tick. Running: up to the last tick as counted, then on to `now` with
 * pauses taken out, no more than 15 minutes past the last tick, so the timer
 * never shows more than will be counted.
 */
export function timerMs(session: TimedSession, sets: TimedSet[], now: number, stopped: boolean, kindOf: KindOf = () => 'weight'): number {
  if (stopped) return workoutMs(session, sets, kindOf);
  const ordered = byTick(sets);
  if (!ordered.length) return elapsedMs(session, now, startOf(session, ordered, kindOf));
  const last = ordered[ordered.length - 1].loggedAt;
  const since = Math.min(Math.max(0, now - last - pausedMs(session.pauses, last, now)), MAX_GAP_MS);
  return Math.min(workoutMs(session, sets, kindOf) + since, MAX_WORKOUT_MS);
}

// ---------- Predictions (W-22, R-17.7, R-17.8, R-17.11) ----------

/** Starting estimates before there is history (W-22 answers 2 and 3). */
export const REST_GUESS_MS = 2 * 60 * 1000;
export const SETUP_GUESS_MS = 5 * 60 * 1000;
export const BETWEEN_GUESS_MS = 3 * 60 * 1000;

/** Your pace, from past workouts: time per set for each exercise, set-up, and time between exercises. */
export interface Pace {
  perSetMs: Map<string, number>;
  setupMs: number;
  betweenMs: number;
}

/** One exercise as planned. For timed exercises repMin/repMax are seconds; for activities, minutes. */
export interface PlannedSlot {
  exerciseId: string;
  kind: ExerciseKind;
  sets: number;
  repMin: number;
  repMax: number;
}

/**
 * Pace from past workouts, newest first. Time per set: an exercise's time over
 * its sets, in the newest 5 workouts it was done in. Set-up: time before the first
 * set began (at most 15 minutes). Between exercises: the workout's time left over
 * after set-up and every set, per change of exercise. Both over the newest 5.
 */
export function paceFrom(newestFirst: { session: TimedSession; sets: TimedSet[] }[], kindOf: KindOf): Pace {
  const time = new Map<string, number>();
  const count = new Map<string, number>();
  const seen = new Map<string, number>();
  const setups: number[] = [];
  const betweens: number[] = [];
  for (const { session, sets } of newestFirst) {
    if (!sets.length) continue;
    const perSet = setTimes(session, sets, kindOf);
    const perEx = exerciseTimes(session, sets, kindOf);
    for (const [ex, ms] of perEx) {
      if (kindOf(ex) === 'activity' || (seen.get(ex) ?? 0) >= AVERAGE_OF) continue;
      seen.set(ex, (seen.get(ex) ?? 0) + 1);
      time.set(ex, (time.get(ex) ?? 0) + ms);
      count.set(ex, (count.get(ex) ?? 0) + sets.filter((s) => s.exerciseId === ex).length);
    }
    const ordered = byTick(sets);
    const start = startOf(session, ordered, kindOf);
    const first = ordered[0];
    const setup = Math.max(0, first.loggedAt - start - pausedMs(session.pauses, start, first.loggedAt) - (perSet.get(first.id) ?? 0));
    if (setups.length < AVERAGE_OF) setups.push(Math.min(setup, MAX_GAP_MS));
    const exercises = perEx.size;
    if (exercises >= 2 && betweens.length < AVERAGE_OF) {
      const setsMs = [...perSet.values()].reduce((a, b) => a + b, 0);
      betweens.push(Math.max(0, workoutMs(session, sets, kindOf) - setup - setsMs) / (exercises - 1));
    }
  }
  const perSetMs = new Map<string, number>();
  for (const [ex, ms] of time) if ((count.get(ex) ?? 0) > 0) perSetMs.set(ex, ms / count.get(ex)!);
  const mean = (xs: number[], guess: number) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : guess);
  return { perSetMs, setupMs: mean(setups, SETUP_GUESS_MS), betweenMs: mean(betweens, BETWEEN_GUESS_MS) };
}

/** One exercise's predicted time: its sets × its own time per set, or a starting estimate if never done. */
export function slotMs(slot: PlannedSlot, pace: Pace): number {
  const mid = (slot.repMin + slot.repMax) / 2;
  if (slot.kind === 'activity') return mid * 60 * 1000;
  const own = pace.perSetMs.get(slot.exerciseId);
  if (own !== undefined) return slot.sets * own;
  const work = slot.kind === 'timed' ? mid * 1000 : mid * SECONDS_PER_REP * 1000;
  return slot.sets * (work + REST_GUESS_MS);
}

/** A workout's prediction: set-up + every exercise + a change of exercise between blocks (a superset is one block). */
export function predictWorkout(blocks: PlannedSlot[][], pace: Pace): { totalMs: number; slotMs: number[][] } {
  const per = blocks.map((b) => b.map((s) => slotMs(s, pace)));
  if (!blocks.length) return { totalMs: 0, slotMs: per };
  const sets = per.flat().reduce((a, b) => a + b, 0);
  return { totalMs: pace.setupMs + sets + pace.betweenMs * (blocks.length - 1), slotMs: per };
}

/**
 * Time left in a workout: the target sets not yet ticked, a change of exercise for
 * each block not yet started, and, before the first tick, what is left of the set-up.
 */
export function timeLeftMs(blocks: { slot: PlannedSlot; done: number }[][], pace: Pace, now: { ticked: boolean; elapsedMs: number }): number {
  let ms = 0;
  let notStarted = 0;
  for (const block of blocks) {
    if (block.every((m) => m.done === 0)) notStarted++;
    for (const { slot, done } of block) {
      const left = Math.max(0, slot.sets - done);
      if (!left) continue;
      ms += slot.kind === 'activity' ? slotMs(slot, pace) : (left / slot.sets) * slotMs(slot, pace);
    }
  }
  if (!now.ticked) return ms + Math.max(0, pace.setupMs - now.elapsedMs) + pace.betweenMs * Math.max(0, notStarted - 1);
  return ms + pace.betweenMs * notStarted;
}
