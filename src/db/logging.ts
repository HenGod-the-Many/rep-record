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
  return db.transaction('rw', [db.sessions, db.plans, db.warmups], async () => {
    const existing = await findSession(db, input);
    if (existing) {
      if (existing.time !== input.time) await db.sessions.update(existing.id, { time: input.time });
      return existing.id;
    }
    const plan = await db.plans.get(input.planId);
    if (!plan) throw new ValidationError('That plan no longer exists.');
    const id = newId();
    const warmup = plan.warmupId ? await db.warmups.get(plan.warmupId) : undefined;
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
      warmupMoves: warmup ? warmup.moves.map((m) => ({ ...m })) : [],
      warmupChecked: [],
      warmupRounds: warmup?.rounds ?? 1,
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
  // An activity slot swaps to other activities; a lifting slot to lifting exercises.
  const slotIsActivity = byId.get(entry.exerciseId)?.kind === 'activity';
  const others = all
    .filter((e) => !e.archived && !skip.has(e.id) && (e.kind === 'activity') === slotIsActivity)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { alternates, others };
}

/* ---------- as-run order (W-17) ---------- */

/**
 * The plan's slots in the order they were done in this workout: slots in the
 * session's saved order first, then any the order doesn't know (added to the
 * plan since) in plan order. Slots no longer in the plan drop out.
 */
export function orderedEntries(session: Session, entries: PlanExercise[]): PlanExercise[] {
  const order = session.slotOrder ?? [];
  if (order.length === 0) return entries;
  const byId = new Map(entries.map((e) => [e.id, e]));
  const listed = order.map((id) => byId.get(id)).filter((e): e is PlanExercise => !!e);
  const known = new Set(order);
  return [...listed, ...entries.filter((e) => !known.has(e.id))];
}

/**
 * The workout's slots as blocks: a single slot, or all the members of a
 * superset/circuit together at the place of the first one (W-19).
 */
export function workoutUnits(ordered: PlanExercise[]): PlanExercise[][] {
  const units: PlanExercise[][] = [];
  const byKey = new Map<string, PlanExercise[]>();
  for (const e of ordered) {
    if (!e.groupKey) {
      units.push([e]);
      continue;
    }
    const unit = byKey.get(e.groupKey);
    if (unit) unit.push(e);
    else {
      const u = [e];
      byKey.set(e.groupKey, u);
      units.push(u);
    }
  }
  // Members keep the plan's order inside their group.
  for (const u of byKey.values()) u.sort((a, b) => a.order - b.order);
  return units;
}

/**
 * Move a slot's block up (-1) or down (+1) in this workout only; a group moves
 * as one block. The plan keeps its order.
 */
export async function moveSlot(db: WorkoutDB, sessionId: string, entries: PlanExercise[], slotId: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) throw new ValidationError('That workout no longer exists.');
    const units = workoutUnits(orderedEntries(s, entries));
    const i = units.findIndex((u) => u.some((e) => e.id === slotId));
    const j = i + direction;
    if (i < 0 || j < 0 || j >= units.length) return;
    [units[i], units[j]] = [units[j], units[i]];
    await db.sessions.update(sessionId, { slotOrder: units.flat().map((e) => e.id) });
  });
}

/** Every target set of the slot is logged (an activity: it is logged once). */
export function slotDone(entry: PlanExercise, logs: SetLog[], kind: ExerciseKind): boolean {
  if (kind === 'activity') return logs.length > 0;
  return new Set(logs.map((l) => l.setNumber)).size >= Math.max(1, entry.targetSets);
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
    if (kind === 'timed' || kind === 'activity') {
      if (!p.seconds || p.seconds <= 0) throw new ValidationError(kind === 'activity' ? 'Enter the duration first.' : 'Enter the seconds first.');
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

/**
 * Change one part of a logged set from its current saved value (used by the ±
 * buttons, so quick repeated taps each count even before the screen refreshes).
 * The other parts of a weight-changed set stay as they are.
 */
export async function adjustSet(db: WorkoutDB, setId: string, change: (part: SetPart) => SetPart, partIndex = 0): Promise<void> {
  await db.transaction('rw', [db.setLogs, db.exercises], async () => {
    const log = await db.setLogs.get(setId);
    if (!log) throw new ValidationError('That set no longer exists.');
    if (!log.parts[partIndex]) throw new ValidationError('That part of the set no longer exists.');
    const parts = log.parts.map((p, i) => (i === partIndex ? change(p) : p));
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
  const current = await db.sessions.get(sessionId);
  const all = (await db.setLogs.where('exerciseId').equals(exerciseId).toArray()).filter((l) => l.sessionId !== sessionId);
  if (all.length === 0) return [];
  const sessions = new Map(
    (await db.sessions.bulkGet([...new Set(all.map((l) => l.sessionId))])).filter((s): s is Session => !!s).map((s) => [s.id, s]),
  );
  // Order sessions by date, then start time; only those before this one count.
  const order = (s: Session | undefined) => [s?.date ?? '', s?.startedAt ?? 0] as const;
  const before = (a: readonly [string, number], b: readonly [string, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  const logs = current ? all.filter((l) => before(order(sessions.get(l.sessionId)), order(current))) : all;
  if (logs.length === 0) return [];
  const ids = [...new Set(logs.map((l) => l.sessionId))];
  const lastLogged = new Map<string, number>();
  for (const l of logs) lastLogged.set(l.sessionId, Math.max(lastLogged.get(l.sessionId) ?? 0, l.loggedAt));
  const key = (id: string) => [...order(sessions.get(id)), lastLogged.get(id) ?? 0] as const;
  const latestId = ids.reduce((best, id) => {
    const [a, b] = [key(id), key(best)];
    return a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))) ? id : best;
  });
  // If the exercise filled two slots that day, use the slot with the most sets.
  const bySlot = new Map<string, SetLog[]>();
  for (const l of logs.filter((x) => x.sessionId === latestId)) {
    const k = l.planExerciseId ?? '';
    bySlot.set(k, [...(bySlot.get(k) ?? []), l]);
  }
  const lastSets = [...bySlot.values()].reduce((a, b) => (b.length > a.length ? b : a)).sort((a, b) => a.setNumber - b.setNumber);
  const out: Prefill[] = [];
  for (let i = 0; i < rows; i++) {
    const l = lastSets[Math.min(i, lastSets.length - 1)];
    out.push({ weightLb: l.parts[0]?.weightLb ?? null, reps: totalReps(l.parts) || null, seconds: l.parts[0]?.seconds ?? null, last: l });
  }
  return out;
}
