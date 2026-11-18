import type { PlanExercise, PlannedWorkout, WorkoutDB } from './db';
import { ValidationError } from './errors';
import { newId } from './ids';

export interface Targets {
  targetSets: number;
  repMin: number;
  repMax: number;
  note?: string;
}

function checkTargets(t: Targets): Targets {
  const whole = (n: number) => Number.isInteger(n);
  if (!whole(t.targetSets) || t.targetSets < 1 || t.targetSets > 20) {
    throw new ValidationError('Sets must be a whole number from 1 to 20.');
  }
  if (!whole(t.repMin) || !whole(t.repMax) || t.repMin < 1 || t.repMax < 1) {
    throw new ValidationError('The range must be whole numbers of 1 or more.');
  }
  if (t.repMin > t.repMax) throw new ValidationError('The low end of the range is above the high end.');
  return { ...t, note: (t.note ?? '').trim() };
}

function cleanName(name: string): string {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) throw new ValidationError('Give the plan a name.');
  return n;
}

export async function listPlans(db: WorkoutDB) {
  return (await db.plans.filter((p) => !p.hidden).toArray()).sort((a, b) => a.name.localeCompare(b.name));
}

/** A plan's entries in order. */
export async function getEntries(db: WorkoutDB, planId: string): Promise<PlanExercise[]> {
  return db.planExercises.where('[planId+order]').between([planId, -Infinity], [planId, Infinity]).toArray();
}

export async function createPlan(db: WorkoutDB, name: string): Promise<string> {
  const id = newId();
  await db.plans.add({ id, name: cleanName(name), notes: '' });
  return id;
}

export async function renamePlan(db: WorkoutDB, planId: string, name: string): Promise<void> {
  await db.plans.update(planId, { name: cleanName(name) });
}

export async function setPlanNotes(db: WorkoutDB, planId: string, notes: string): Promise<void> {
  await db.plans.update(planId, { notes });
}

/**
 * Delete a plan and its entries. Logged sets are untouched (they belong to
 * exercises; sessions keep a snapshot of the plan's name). Split days that
 * used the plan lose it (a day left with no workouts is a rest day). A hand-made
 * date change that held only this plan is removed, so the date follows the split.
 */
export async function deletePlan(db: WorkoutDB, planId: string): Promise<void> {
  await db.transaction('rw', [db.plans, db.planExercises, db.splitDays, db.dateOverrides], async () => {
    await db.planExercises.where('planId').equals(planId).delete();
    const without = (w: { workouts: PlannedWorkout[] }) => {
      w.workouts = w.workouts.filter((x) => x.planId !== planId);
    };
    await db.splitDays.filter((d) => d.workouts.some((x) => x.planId === planId)).modify(without);
    // A hand-made date change that only held this plan is removed, so that date
    // follows the split again; one that also held other workouts keeps those.
    const touched = await db.dateOverrides.filter((d) => d.workouts.some((x) => x.planId === planId)).toArray();
    for (const o of touched) {
      const rest = o.workouts.filter((x) => x.planId !== planId);
      if (rest.length === 0) await db.dateOverrides.delete(o.date);
      else await db.dateOverrides.put({ ...o, workouts: rest });
    }
    await db.plans.delete(planId);
  });
}

/** Copy a plan and all its entries; the copy is fully independent. */
export async function duplicatePlan(db: WorkoutDB, planId: string): Promise<string> {
  return db.transaction('rw', [db.plans, db.planExercises], async () => {
    const plan = await db.plans.get(planId);
    if (!plan) throw new ValidationError('That plan no longer exists.');
    const copyId = newId();
    const taken = new Set((await db.plans.toArray()).map((p) => p.name));
    const base = `${plan.name.replace(/ \(copy(?: \d+)?\)$/, '')} (copy)`;
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base.slice(0, -1)} ${n})`;
    await db.plans.add({ id: copyId, name, notes: plan.notes });
    for (const e of await getEntries(db, planId)) {
      await db.planExercises.add({ ...e, id: newId(), planId: copyId, alternateIds: [...e.alternateIds] });
    }
    return copyId;
  });
}

export async function addEntry(
  db: WorkoutDB,
  planId: string,
  exerciseId: string,
  targets: Targets = { targetSets: 3, repMin: 8, repMax: 12 },
): Promise<string> {
  const t = checkTargets(targets);
  return db.transaction('rw', [db.plans, db.planExercises, db.exercises], async () => {
    if (!(await db.plans.get(planId))) throw new ValidationError('That plan no longer exists.');
    if (!(await db.exercises.get(exerciseId))) throw new ValidationError('That exercise no longer exists.');
    const entries = await getEntries(db, planId);
    const order = entries.length ? entries[entries.length - 1].order + 1 : 0;
    const id = newId();
    await db.planExercises.add({
      id,
      planId,
      exerciseId,
      order,
      targetSets: t.targetSets,
      repMin: t.repMin,
      repMax: t.repMax,
      alternateIds: [],
      note: t.note ?? '',
    });
    return id;
  });
}

async function renumber(db: WorkoutDB, planId: string) {
  const entries = await getEntries(db, planId);
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].order !== i) await db.planExercises.update(entries[i].id, { order: i });
  }
}

export async function removeEntry(db: WorkoutDB, entryId: string): Promise<void> {
  await db.transaction('rw', db.planExercises, async () => {
    const entry = await db.planExercises.get(entryId);
    if (!entry) return;
    await db.planExercises.delete(entryId);
    await renumber(db, entry.planId);
  });
}

/** Move an entry one place up (-1) or down (+1). No-op at either end. */
export async function moveEntry(db: WorkoutDB, entryId: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.planExercises, async () => {
    const entry = await db.planExercises.get(entryId);
    if (!entry) return;
    const entries = await getEntries(db, entry.planId);
    const i = entries.findIndex((e) => e.id === entryId);
    const j = i + direction;
    if (j < 0 || j >= entries.length) return;
    await db.planExercises.update(entries[i].id, { order: entries[j].order });
    await db.planExercises.update(entries[j].id, { order: entries[i].order });
  });
}

export async function updateTargets(db: WorkoutDB, entryId: string, targets: Targets): Promise<void> {
  const t = checkTargets(targets);
  await db.planExercises.update(entryId, {
    targetSets: t.targetSets,
    repMin: t.repMin,
    repMax: t.repMax,
    note: t.note ?? '',
  });
}

/**
 * Permanently put a different exercise in this plan slot. Only the plan
 * changes: sets already logged for the old exercise keep their exerciseId.
 */
export async function replaceEntryExercise(db: WorkoutDB, entryId: string, exerciseId: string): Promise<void> {
  await db.transaction('rw', [db.planExercises, db.exercises], async () => {
    const entry = await db.planExercises.get(entryId);
    if (!entry) throw new ValidationError('That plan entry no longer exists.');
    if (!(await db.exercises.get(exerciseId))) throw new ValidationError('That exercise no longer exists.');
    await db.planExercises.update(entryId, {
      exerciseId,
      alternateIds: entry.alternateIds.filter((id) => id !== exerciseId),
    });
  });
}

export async function addAlternate(db: WorkoutDB, entryId: string, exerciseId: string): Promise<void> {
  await db.transaction('rw', db.planExercises, async () => {
    const entry = await db.planExercises.get(entryId);
    if (!entry) throw new ValidationError('That plan entry no longer exists.');
    if (exerciseId === entry.exerciseId) throw new ValidationError('That is already the main exercise.');
    if (entry.alternateIds.includes(exerciseId)) return;
    await db.planExercises.update(entryId, { alternateIds: [...entry.alternateIds, exerciseId] });
  });
}

export async function removeAlternate(db: WorkoutDB, entryId: string, exerciseId: string): Promise<void> {
  await db.transaction('rw', db.planExercises, async () => {
    const entry = await db.planExercises.get(entryId);
    if (!entry) return;
    await db.planExercises.update(entryId, {
      alternateIds: entry.alternateIds.filter((id) => id !== exerciseId),
    });
  });
}
