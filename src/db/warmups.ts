import type { Warmup, WarmupMove, WorkoutDB } from './db';
import { ValidationError } from './errors';
import { newId } from './ids';

/**
 * Warm-up routines (W-16): a named, ordered list of moves, each with reps or a
 * time. Moves are plain text, so warm-ups never appear in history or records.
 * A plan can have one attached; starting its workout copies the moves into the
 * workout, where each is checked off with one tap.
 */

function cleanName(name: string, what: string): string {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) throw new ValidationError(`Give the ${what} a name.`);
  return n;
}

/** A move must have a name and exactly one of reps or seconds, a whole number above 0. */
export function checkMove(m: WarmupMove): WarmupMove {
  const name = cleanName(m.name, 'move');
  const hasReps = m.reps !== null && m.reps !== undefined;
  const hasSecs = m.seconds !== null && m.seconds !== undefined;
  if (hasReps === hasSecs) throw new ValidationError('Give the move either reps or a time.');
  const v = (hasReps ? m.reps : m.seconds) as number;
  if (!Number.isInteger(v) || v < 1) throw new ValidationError(hasReps ? 'Reps must be a whole number above 0.' : 'The time must be at least 1 second.');
  return { name, reps: hasReps ? v : null, seconds: hasSecs ? v : null };
}

export async function listWarmups(db: WorkoutDB): Promise<Warmup[]> {
  return (await db.warmups.toArray()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function createWarmup(db: WorkoutDB, name: string): Promise<string> {
  const n = cleanName(name, 'warm-up');
  const id = newId();
  await db.warmups.add({ id, name: n, moves: [] });
  return id;
}

export async function renameWarmup(db: WorkoutDB, id: string, name: string): Promise<void> {
  const n = cleanName(name, 'warm-up');
  if ((await db.warmups.update(id, { name: n })) === 0 && !(await db.warmups.get(id))) {
    throw new ValidationError('That warm-up no longer exists.');
  }
}

async function changeMoves(db: WorkoutDB, id: string, fn: (moves: WarmupMove[]) => WarmupMove[]): Promise<void> {
  await db.transaction('rw', db.warmups, async () => {
    const w = await db.warmups.get(id);
    if (!w) throw new ValidationError('That warm-up no longer exists.');
    await db.warmups.update(id, { moves: fn([...w.moves]) });
  });
}

export async function addMove(db: WorkoutDB, id: string, move: WarmupMove): Promise<void> {
  const m = checkMove(move);
  await changeMoves(db, id, (moves) => [...moves, m]);
}

export async function updateMove(db: WorkoutDB, id: string, index: number, move: WarmupMove): Promise<void> {
  const m = checkMove(move);
  await changeMoves(db, id, (moves) => {
    if (!moves[index]) throw new ValidationError('That move no longer exists.');
    moves[index] = m;
    return moves;
  });
}

export async function removeMove(db: WorkoutDB, id: string, index: number): Promise<void> {
  await changeMoves(db, id, (moves) => moves.filter((_, i) => i !== index));
}

/** Move a move up (-1) or down (+1). Moving past either end does nothing. */
export async function reorderMove(db: WorkoutDB, id: string, index: number, direction: -1 | 1): Promise<void> {
  await changeMoves(db, id, (moves) => {
    const to = index + direction;
    if (to < 0 || to >= moves.length || !moves[index]) return moves;
    [moves[index], moves[to]] = [moves[to], moves[index]];
    return moves;
  });
}

/** Names of the plans a warm-up is attached to (for the delete confirm). One-date copies are left out. */
export async function plansUsingWarmup(db: WorkoutDB, id: string): Promise<string[]> {
  return (await db.plans.filter((p) => p.warmupId === id && !p.hidden).toArray()).map((p) => p.name).sort();
}

/** Delete a routine and detach it from every plan (and one-date copy) that had it. Past workouts keep their copy. */
export async function deleteWarmup(db: WorkoutDB, id: string): Promise<void> {
  await db.transaction('rw', db.warmups, db.plans, async () => {
    await db.plans.filter((p) => p.warmupId === id).modify({ warmupId: null });
    await db.warmups.delete(id);
  });
}

export async function setPlanWarmup(db: WorkoutDB, planId: string, warmupId: string | null): Promise<void> {
  await db.transaction('rw', db.plans, db.warmups, async () => {
    if (!(await db.plans.get(planId))) throw new ValidationError('That plan no longer exists.');
    if (warmupId && !(await db.warmups.get(warmupId))) throw new ValidationError('That warm-up no longer exists.');
    await db.plans.update(planId, { warmupId });
  });
}

/** How many times through the moves (W-19): a whole number from 1 to 10. */
export async function setWarmupRounds(db: WorkoutDB, id: string, rounds: number): Promise<void> {
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) throw new ValidationError('Rounds must be a whole number from 1 to 10.');
  if (!(await db.warmups.get(id))) throw new ValidationError('That warm-up no longer exists.');
  await db.warmups.update(id, { rounds });
}

/** One tap on a move in a workout: checks it, or unchecks it if it was checked. Saved at once. */
export async function toggleWarmupMove(db: WorkoutDB, sessionId: string, index: number): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) throw new ValidationError('That workout no longer exists.');
    const checked = new Set(s.warmupChecked ?? []);
    if (checked.has(index)) checked.delete(index);
    else checked.add(index);
    await db.sessions.update(sessionId, { warmupChecked: [...checked].sort((a, b) => a - b) });
  });
}

/** "10 reps", "2 min", "45 s", "1 min 30 s". */
export function moveAmount(m: WarmupMove): string {
  if (m.reps !== null) return `${m.reps} ${m.reps === 1 ? 'rep' : 'reps'}`;
  const s = m.seconds ?? 0;
  const min = Math.floor(s / 60);
  const sec = s % 60;
  if (min && sec) return `${min} min ${sec} s`;
  return min ? `${min} min` : `${sec} s`;
}
