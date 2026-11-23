import type { Exercise, SetLog, WorkoutDB } from './db';
import { bodyweightOn } from './body';
import { ValidationError } from './errors';
import { logSet } from './logging';
import { LB_PER_KG, type Unit } from './units';
import { DEFAULT_MET } from './activityData';

/**
 * Activities (W-15): runs, rides, hikes, swims and your own. Stored as one set
 * log with one part: duration in parts[0].seconds, distance in miles, optional
 * average heart rate and calories typed by hand; effort uses `difficulty`.
 */

export const KM_PER_MI = 1.609344;

/** Miles -> the distance shown (mi, or km when the unit setting is kg). */
export function toShownDistance(mi: number, unit: Unit): number {
  return unit === 'kg' ? mi * KM_PER_MI : mi;
}

export function fromShownDistance(shown: number, unit: Unit): number {
  return unit === 'kg' ? shown / KM_PER_MI : shown;
}

export const distanceUnit = (unit: Unit) => (unit === 'kg' ? 'km' : 'mi');

/** "8 mi", "12.87 km" (at most 2 decimals). */
export function formatDistance(mi: number, unit: Unit): string {
  return `${Math.round(toShownDistance(mi, unit) * 100) / 100} ${distanceUnit(unit)}`;
}

/** "45 min", "1 h 5 min". */
export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
}

/** Pace for runs and walks ("9:30 /mi"), speed for everything else ("16 mi/h"). */
export function paceOrSpeed(exerciseName: string, seconds: number, mi: number, unit: Unit): string {
  const d = toShownDistance(mi, unit);
  if (d <= 0 || seconds <= 0) return '';
  const u = distanceUnit(unit);
  if (/run|walk|hike/i.test(exerciseName)) {
    const total = Math.round(seconds / d); // whole seconds per mile or km, then split
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /${u}`;
  }
  return `${Math.round((d / (seconds / 3600)) * 10) / 10} ${u}/h`;
}

/**
 * Estimated calories: MET × bodyweight in kg × hours, rounded to the nearest 5.
 * Example: 30 min of cycling (MET 7.5) at 180 lb = 7.5 × 81.6 × 0.5 = 306 → 305.
 */
export function estimateCalories(met: number, bodyweightLb: number, seconds: number): number {
  return Math.round((met * (bodyweightLb / LB_PER_KG) * (seconds / 3600)) / 5) * 5;
}

export interface ActivityInput {
  sessionId: string;
  exerciseId: string;
  planExerciseId: string | null;
  seconds: number;
  distanceMi: number | null;
  difficulty?: number | null;
  avgHr?: number | null;
  calories?: number | null;
}

function checkOptional(v: number | null | undefined, what: string, max: number): number | null {
  if (v === null || v === undefined) return null;
  if (!Number.isFinite(v) || v <= 0 || v > max) throw new ValidationError(`Check the ${what}.`);
  return Math.round(v);
}

/** Log (or update) an activity in a workout. One log per activity per workout slot. */
export async function logActivity(db: WorkoutDB, input: ActivityInput): Promise<string> {
  const ex = await db.exercises.get(input.exerciseId);
  if (!ex) throw new ValidationError('That exercise no longer exists.');
  if (ex.kind !== 'activity') throw new ValidationError('That exercise is not an activity.');
  if (!Number.isFinite(input.seconds) || input.seconds <= 0) throw new ValidationError('Enter the duration first.');
  let distanceMi: number | null = null;
  if (ex.hasDistance && input.distanceMi !== null) {
    if (!Number.isFinite(input.distanceMi) || input.distanceMi <= 0) throw new ValidationError('The distance must be above 0.');
    distanceMi = input.distanceMi;
  }
  const avgHr = checkOptional(input.avgHr, 'heart rate', 250);
  const calories = checkOptional(input.calories, 'calories', 10000);
  // One transaction, so the set and its distance, heart rate and calories are saved together or not at all.
  return db.transaction('rw', [db.setLogs, db.exercises, db.sessions], async () => {
    const id = await logSet(db, {
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      planExerciseId: input.planExerciseId,
      setNumber: 1,
      parts: [{ weightLb: null, reps: null, seconds: Math.round(input.seconds) }],
      difficulty: input.difficulty ?? null,
    });
    await db.setLogs.update(id, { distanceMi, avgHr, calories });
    return id;
  });
}

/** The most recent earlier log of this activity (any plan), for pre-filling. */
export async function lastActivity(db: WorkoutDB, sessionId: string, exerciseId: string): Promise<SetLog | null> {
  const here = await db.sessions.get(sessionId);
  if (!here) return null;
  const logs = await db.setLogs.where('exerciseId').equals(exerciseId).toArray();
  const sessions = new Map((await db.sessions.bulkGet([...new Set(logs.map((l) => l.sessionId))])).filter(Boolean).map((s) => [s!.id, s!]));
  const earlier = logs
    .filter((l) => {
      const s = sessions.get(l.sessionId);
      return s && s.id !== sessionId && (s.date < here.date || (s.date === here.date && s.startedAt < here.startedAt));
    })
    .sort((a, b) => {
      const sa = sessions.get(a.sessionId)!;
      const sb = sessions.get(b.sessionId)!;
      return sa.date === sb.date ? sb.startedAt - sa.startedAt : sa.date < sb.date ? 1 : -1;
    });
  return earlier[0] ?? null;
}

export type Calories = { kcal: number; estimated: boolean } | { kcal: null; needsBodyweight: true };

/** Typed calories, else an estimate from the bodyweight on or before the activity's date. */
export async function caloriesFor(db: WorkoutDB, log: SetLog, exercise: Exercise, date: string): Promise<Calories> {
  if (log.calories) return { kcal: log.calories, estimated: false };
  const lb = await bodyweightOn(db, date);
  const seconds = log.parts[0]?.seconds ?? 0;
  if (lb === null) return { kcal: null, needsBodyweight: true };
  return { kcal: estimateCalories(exercise.met ?? DEFAULT_MET, lb, seconds), estimated: true };
}

/** Activities in a date range: how many, total time and total distance (W-12's card). */
export async function activityTotals(db: WorkoutDB, from: string, to: string): Promise<{ count: number; seconds: number; distanceMi: number }> {
  const sessions = await db.sessions.where('date').between(from, to, true, true).toArray();
  if (!sessions.length) return { count: 0, seconds: 0, distanceMi: 0 };
  const activityIds = new Set((await db.exercises.toArray()).filter((e) => e.kind === 'activity').map((e) => e.id));
  const logs = (await db.setLogs.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray()).filter((l) => activityIds.has(l.exerciseId));
  return {
    count: logs.length,
    seconds: logs.reduce((s, l) => s + (l.parts[0]?.seconds ?? 0), 0),
    distanceMi: logs.reduce((s, l) => s + (l.distanceMi ?? 0), 0),
  };
}
