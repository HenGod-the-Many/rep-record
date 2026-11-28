import type { Exercise, ExerciseKind, WorkoutDB } from './db';
import { ValidationError } from './errors';
import { newId } from './ids';
import { DEFAULT_MET } from './activityData';

export interface ExerciseInput {
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: ExerciseKind;
  /** Activities only. */
  hasDistance?: boolean;
  met?: number;
}

const KINDS: ExerciseKind[] = ['weight', 'bodyweight', 'timed', 'activity'];

export const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

function clean(input: ExerciseInput): ExerciseInput {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name) throw new ValidationError('Give the exercise a name.');
  if (!KINDS.includes(input.kind)) throw new ValidationError('Choose how the exercise is measured.');
  const base = { name, muscleGroup: input.muscleGroup.trim(), equipment: input.equipment.trim(), kind: input.kind };
  if (input.kind !== 'activity') return base;
  const met = input.met ?? DEFAULT_MET;
  if (!Number.isFinite(met) || met < 1 || met > 25) throw new ValidationError('The MET value should be between 1 and 25.');
  return { ...base, hasDistance: input.hasDistance ?? true, met };
}

async function assertNameFree(db: WorkoutDB, name: string, exceptId?: string) {
  const key = normalizeName(name);
  const clash = await db.exercises
    .filter((e) => e.id !== exceptId && normalizeName(e.name) === key)
    .first();
  if (clash) {
    throw new ValidationError(
      `An exercise called "${clash.name}" already exists${clash.archived ? ' (archived)' : ''}.`,
    );
  }
}

/** All exercises sorted by name; archived ones only when asked for. */
export async function listExercises(
  db: WorkoutDB,
  opts: { includeArchived?: boolean } = {},
): Promise<Exercise[]> {
  const all = await db.exercises.toArray();
  return all
    .filter((e) => opts.includeArchived || !e.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createExercise(db: WorkoutDB, input: ExerciseInput): Promise<string> {
  const data = clean(input);
  return db.transaction('rw', db.exercises, async () => {
    await assertNameFree(db, data.name);
    const id = newId();
    await db.exercises.add({ id, ...data, archived: false });
    return id;
  });
}

export async function updateExercise(db: WorkoutDB, id: string, input: ExerciseInput): Promise<void> {
  const data = clean(input);
  await db.transaction('rw', db.exercises, async () => {
    if (!(await db.exercises.get(id))) throw new ValidationError('That exercise no longer exists.');
    await assertNameFree(db, data.name, id);
    await db.exercises.update(id, data);
  });
}

/**
 * Archive or restore. There is deliberately no delete: logged sets point at
 * exercises, and history must never lose its exercise.
 */
export async function setArchived(db: WorkoutDB, id: string, archived: boolean): Promise<void> {
  await db.exercises.update(id, { archived });
}

/** How many sets have been logged for an exercise (history follows the exercise). */
export async function loggedSetCount(db: WorkoutDB, exerciseId: string): Promise<number> {
  return db.setLogs.where('exerciseId').equals(exerciseId).count();
}

/** Distinct muscle groups in use, for the form's suggestions. */
export async function muscleGroups(db: WorkoutDB): Promise<string[]> {
  const all = await db.exercises.toArray();
  return [...new Set(all.map((e) => e.muscleGroup).filter(Boolean))].sort();
}
