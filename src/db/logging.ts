import type { Exercise, ExerciseKind, PlanExercise, Session, SetLog, SetPart, WorkoutDB } from './db';
import { ValidationError } from './errors';
import { newId } from './ids';

/* ---------- sessions ---------- */

export interface StartInput {
  date: string;
  planId: string;
  time: string;
  /**
   * The times this plan is planned at on that date. A session whose time is no
   * longer among them (the workout's time was changed) is resumed rather than
   * a second one started.
   */
  plannedTimes?: string[];
}

/** The session for this planned workout on this date, if one was started. */
export async function findSession(db: WorkoutDB, input: StartInput): Promise<Session | undefined> {
  const same = await db.sessions.where('[date+planId]').equals([input.date, input.planId]).toArray();
  const exact = same.find((s) => s.time === input.time);
  if (exact) return exact;
  const planned = new Set(input.plannedTimes ?? [input.time]);
  return same.find((s) => !planned.has(s.time));
}

/** Start a workout, or resume it if it was already started that day. Returns the session id. */
export async function startOrResume(db: WorkoutDB, input: StartInput): Promise<string> {
  return db.transaction('rw', [db.sessions, db.plans], async () => {
    const existing = await findSession(db, input);
    if (existing) {
      if (existing.time !== input.time) await db.sessions.update(existing.id, { time: input.time });
      return existing.id;
    }
    const plan = await db.plans.get(input.planId);
    if (!plan) throw new ValidationError('That plan no longer exists.');
    const id = newId();
    await db.sessions.add({
      id,
      date: input.date,
      time: input.time,
      planId: input.planId,
      planName: plan.name,
      splitId: null,
      journalNote: '',
      startedAt: Date.now(),
      finishedAt: null,
      swaps: {},
    });
    return id;
  });
}

export async function finishSession(db: WorkoutDB, sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { finishedAt: Date.now() });
}

export async function reopenSession(db: WorkoutDB, sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { finishedAt: null });
}

export async function sessionsOn(db: WorkoutDB, date: string): Promise<Session[]> {
  return db.sessions.where('date').equals(date).toArray();
}

/* ---------- session-only swap ---------- */

/** The exercise a plan slot uses in this session (the substitute, if swapped). */
export function activeExerciseId(session: Session, entry: PlanExercise): string {
  return session.swaps[entry.id] ?? entry.exerciseId;
}

/** Swap a slot's exercise for this session only. Swapping back to the plan's exercise clears the swap. */
export async function swapForSession(db: WorkoutDB, sessionId: string, entry: PlanExercise, exerciseId: string): Promise<void> {
  await db.transaction('rw', [db.sessions, db.exercises], async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) throw new ValidationError('That workout no longer exists.');
    const ex = await db.exercises.get(exerciseId);
    if (!ex) throw new ValidationError('That exercise no longer exists.');
    const swaps = { ...s.swaps };
    if (exerciseId === entry.exerciseId) delete swaps[entry.id];
    else swaps[entry.id] = exerciseId;
    await db.sessions.update(sessionId, { swaps });
  });
}

/** Swap choices: the slot's alternates first, then the rest of the active library by name. */
export async function swapChoices(db: WorkoutDB, entry: PlanExercise, current: string): Promise<{ alternates: Exercise[]; others: Exercise[] }> {
  const all = await db.exercises.toArray();
  const byId = new Map(all.map((e) => [e.id, e]));
  const alternates = entry.alternateIds
    .map((id) => byId.get(id))
    .filter((e): e is Exercise => !!e && !e.archived && e.id !== current);
  const skip = new Set([current, ...alternates.map((e) => e.id)]);
  const others = all.filter((e) => !e.archived && !skip.has(e.id)).sort((a, b) => a.name.localeCompare(b.name));
  return { alternates, others };
}

/* ---------- set parts (pure) ---------- */

export const totalReps = (parts: SetPart[]) => parts.reduce((n, p) => n + (p.reps ?? 0), 0);

/**
 * Weight changed during the set: from rep `atRep` (1-based, counted across the
 * whole set) onward the weight is `newWeightLb`. Reps before it keep their
 * weight. E.g. 8 × 135, change at rep 6 to 115 -> 5 × 135 then 3 × 115.
 */
export function changeWeightAt(parts: SetPart[], atRep: number, newWeightLb: number): SetPart[] {
  const total = totalReps(parts);
  if (!Number.isInteger(atRep) || atRep < 1 || atRep > total) {
    throw new ValidationError(`Pick a rep from 1 to ${total}.`);
  }
  if (!Number.isFinite(newWeightLb) || newWeightLb < 0) throw new ValidationError('Enter the new weight.');
  const before: SetPart[] = [];
  let left = atRep - 1;
  for (const p of parts) {
    if (left <= 0) break;
    const r = Math.min(p.reps ?? 0, left);
    if (r > 0) before.push({ ...p, reps: r });
    left -= r;
  }
  const after: SetPart = { weightLb: newWeightLb, reps: total - (atRep - 1), seconds: null };
  return mergeSameWeight([...before, after]);
}

/** Set how many reps were done in total. Fewer trims from the end; more go on the last part. */
export function setTotalReps(parts: SetPart[], reps: number): SetPart[] {
  if (!Number.isInteger(reps) || reps < 1) throw new ValidationError('Reps must be a whole number of at least 1.');
  const out: SetPart[] = [];
  let left = reps;
  for (const p of parts) {
    if (left <= 0) break;
    const r = Math.min(p.reps ?? 0, left);
    if (r > 0) out.push({ ...p, reps: r });
    left -= r;
  }
  if (left > 0) {
    if (out.length === 0) out.push({ ...parts[0], reps: left });
    else out[out.length - 1] = { ...out[out.length - 1], reps: (out[out.length - 1].reps ?? 0) + left };
  }
  return out;
}

function mergeSameWeight(parts: SetPart[]): SetPart[] {
  const out: SetPart[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && last.weightLb === p.weightLb) out[out.length - 1] = { ...last, reps: (last.reps ?? 0) + (p.reps ?? 0) };
    else out.push({ ...p });
  }
  return out;
}

/** A set's parts are complete enough to log for this kind of exercise. */
export function checkParts(parts: SetPart[], kind: ExerciseKind): void {
  if (parts.length === 0) throw new ValidationError('A set needs at least one part.');
  for (const p of parts) {
    if (kind === 'timed') {
      if (!p.seconds || p.seconds <= 0) throw new ValidationError('Enter the seconds first.');
    } else {
      if (!p.reps || p.reps < 1 || !Number.isInteger(p.reps)) throw new ValidationError('Enter the reps first.');
      if (kind === 'weight' && (p.weightLb === null || p.weightLb < 0)) throw new ValidationError('Enter the weight first.');
      if (p.weightLb !== null && p.weightLb < 0) throw new ValidationError('Weight cannot be negative.');
    }
  }
}

function checkDifficulty(d: number | null): void {
  if (d !== null && (!Number.isInteger(d) || d < 1 || d > 10)) throw new ValidationError('Difficulty is 1 to 10.');
}

/* ---------- logging sets ---------- */

export interface LogInput {
  sessionId: string;
  exerciseId: string;
  planExerciseId: string | null;
  setNumber: number;
  parts: SetPart[];
  difficulty?: number | null;
  toFailure?: boolean;
}

/** The sets logged in this session for one exercise in one slot, by set number. */
export async function setsFor(db: WorkoutDB, sessionId: string, exerciseId: string, planExerciseId: string | null): Promise<SetLog[]> {
  const logs = await db.setLogs.where('sessionId').equals(sessionId).toArray();
  return logs
    .filter((l) => l.exerciseId === exerciseId && l.planExerciseId === planExerciseId)
    .sort((a, b) => a.setNumber - b.setNumber);
}

/**
 * Log a set and save it at once. Logging a set number that is already logged
 * replaces its values (a second tap never makes a duplicate).
 */
export async function logSet(db: WorkoutDB, input: LogInput): Promise<string> {
  return db.transaction('rw', [db.setLogs, db.exercises, db.sessions], async () => {
    const ex = await db.exercises.get(input.exerciseId);
    if (!ex) throw new ValidationError('That exercise no longer exists.');
    if (!(await db.sessions.get(input.sessionId))) throw new ValidationError('That workout no longer exists.');
    checkParts(input.parts, ex.kind);
    checkDifficulty(input.difficulty ?? null);
    const existing = (await setsFor(db, input.sessionId, input.exerciseId, input.planExerciseId)).find(
      (l) => l.setNumber === input.setNumber,
    );
    const parts = input.parts.map((p) => ({ weightLb: p.weightLb, reps: p.reps, seconds: p.seconds }));
    if (existing) {
      await db.setLogs.update(existing.id, {
        parts,
        ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
        ...(input.toFailure !== undefined ? { toFailure: input.toFailure } : {}),
      });
      return existing.id;
    }
    const id = newId();
    await db.setLogs.add({
      id,
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      planExerciseId: input.planExerciseId,
      setNumber: input.setNumber,
      parts,
      difficulty: input.difficulty ?? null,
      toFailure: input.toFailure ?? false,
      note: '',
      loggedAt: Date.now(),
    });
    return id;
  });
}

/** Change a logged set's numbers. */
export async function updateSetParts(db: WorkoutDB, setId: string, parts: SetPart[]): Promise<void> {
  await db.transaction('rw', [db.setLogs, db.exercises], async () => {
    const log = await db.setLogs.get(setId);
    if (!log) throw new ValidationError('That set no longer exists.');
    const ex = await db.exercises.get(log.exerciseId);
    checkParts(parts, ex?.kind ?? 'weight');
    await db.setLogs.update(setId, { parts });
  });
}

export async function setDifficulty(db: WorkoutDB, setId: string, difficulty: number | null): Promise<void> {
  checkDifficulty(difficulty);
  await db.setLogs.update(setId, { difficulty });
}

export async function setToFailure(db: WorkoutDB, setId: string, toFailure: boolean): Promise<void> {
  await db.setLogs.update(setId, { toFailure });
}

/** Delete a logged set; later sets of the same exercise move up one number. */
export async function deleteSet(db: WorkoutDB, setId: string): Promise<void> {
  await db.transaction('rw', [db.setLogs], async () => {
    const log = await db.setLogs.get(setId);
    if (!log) return;
    await db.setLogs.delete(setId);
    const later = (await setsFor(db, log.sessionId, log.exerciseId, log.planExerciseId)).filter((l) => l.setNumber > log.setNumber);
    for (const l of later) await db.setLogs.update(l.id, { setNumber: l.setNumber - 1 });
  });
}

/* ---------- pre-fill ---------- */

export interface Prefill {
  /** What to put in the row: weight (first part), total reps, seconds. */
  weightLb: number | null;
  reps: number | null;
  seconds: number | null;
  /** Last time's set, for the "last:" line. */
  last: SetLog;
}

/**
 * Pre-fill rows from the most recent earlier session in which this exercise
 * was logged, in any plan (keyed on exerciseId). Row n uses set n; if last
 * time had fewer sets, the extra rows use its last set. Empty list = first time.
 */
export async function prefillFor(db: WorkoutDB, sessionId: string, exerciseId: string, rows: number): Promise<Prefill[]> {
  const logs = (await db.setLogs.where('exerciseId').equals(exerciseId).toArray()).filter((l) => l.sessionId !== sessionId);
  if (logs.length === 0) return [];
  // Latest session by date, then start time, then when its last set was logged.
  const ids = [...new Set(logs.map((l) => l.sessionId))];
  const sessions = new Map((await db.sessions.bulkGet(ids)).filter((s): s is Session => !!s).map((s) => [s.id, s]));
  const lastLogged = new Map<string, number>();
  for (const l of logs) lastLogged.set(l.sessionId, Math.max(lastLogged.get(l.sessionId) ?? 0, l.loggedAt));
  const key = (id: string) => {
    const s = sessions.get(id);
    return [s?.date ?? '', s?.startedAt ?? 0, lastLogged.get(id) ?? 0] as const;
  };
  const latestId = ids.reduce((best, id) => {
    const [a, b] = [key(id), key(best)];
    return a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))) ? id : best;
  });
  const lastSets = logs.filter((l) => l.sessionId === latestId).sort((a, b) => a.setNumber - b.setNumber);
  const out: Prefill[] = [];
  for (let i = 0; i < rows; i++) {
    const l = lastSets[Math.min(i, lastSets.length - 1)];
    out.push({ weightLb: l.parts[0]?.weightLb ?? null, reps: totalReps(l.parts) || null, seconds: l.parts[0]?.seconds ?? null, last: l });
  }
  return out;
}
