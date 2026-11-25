import type { PlanExercise, PlannedWorkout, WorkoutDB } from './db';
import { ValidationError } from './errors';
import { newId } from './ids';

export interface Targets {
  targetSets: number;
  repMin: number;
  repMax: number;
  note?: string;
}

const DEFAULT_TARGETS: Targets = { targetSets: 3, repMin: 8, repMax: 12 };

/** An activity's target in a plan: minutes, and optionally a distance in miles. */
export async function setActivityTarget(db: WorkoutDB, entryId: string, minutes: number, distanceMi: number | null): Promise<void> {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new ValidationError('Minutes must be a whole number from 1 to 1440.');
  if (distanceMi !== null && (!Number.isFinite(distanceMi) || distanceMi <= 0)) throw new ValidationError('The distance must be above 0.');
  if (!(await db.planExercises.get(entryId))) throw new ValidationError('That entry no longer exists.');
  await db.planExercises.update(entryId, { targetSets: 1, repMin: minutes, repMax: minutes, targetDistanceMi: distanceMi });
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
    await db.plans.add({ id: copyId, name, notes: plan.notes, warmupId: plan.warmupId ?? null, folderId: plan.folderId ?? null });
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
  targets: Targets = DEFAULT_TARGETS,
): Promise<string> {
  return db.transaction('rw', [db.plans, db.planExercises, db.exercises], async () => {
    if (!(await db.plans.get(planId))) throw new ValidationError('That plan no longer exists.');
    const ex = await db.exercises.get(exerciseId);
    if (!ex) throw new ValidationError('That exercise no longer exists.');
    const t = checkTargets(ex.kind === 'activity' && targets === DEFAULT_TARGETS ? { targetSets: 1, repMin: 30, repMax: 30 } : targets);
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
    // A group left with one member is no longer a group (W-19).
    if (entry.groupKey) {
      const rest = (await getEntries(db, entry.planId)).filter((e) => e.groupKey === entry.groupKey);
      if (rest.length < 2) for (const e of rest) await db.planExercises.update(e.id, NO_GROUP);
    }
  });
}

/** The fields that clear an entry's superset/circuit. */
export const NO_GROUP = { groupKey: null, groupKind: undefined, groupRounds: undefined };

/** Move an entry one place up (-1) or down (+1). No-op at either end. */
export async function moveEntry(db: WorkoutDB, entryId: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.planExercises, async () => {
    const entry = await db.planExercises.get(entryId);
    if (!entry) return;
    const entries = await getEntries(db, entry.planId);
    const i = entries.findIndex((e) => e.id === entryId);
    // Grouped only if another entry shares the key (a lone stale key moves freely).
    const grouped = !!entry.groupKey && entries.some((e) => e.id !== entryId && e.groupKey === entry.groupKey);
    if (grouped) {
      // A member moves only within its group.
      const j = i + direction;
      if (j < 0 || j >= entries.length || entries[j].groupKey !== entry.groupKey) return;
      [entries[i], entries[j]] = [entries[j], entries[i]];
    } else {
      // An ungrouped entry jumps over a whole neighbouring group.
      let j = i + direction;
      if (j < 0 || j >= entries.length) return;
      const key = entries[j].groupKey;
      if (key) while (j + direction >= 0 && j + direction < entries.length && entries[j + direction].groupKey === key) j += direction;
      const [moved] = entries.splice(i, 1);
      entries.splice(j, 0, moved);
    }
    for (let n = 0; n < entries.length; n++) {
      if (entries[n].order !== n) await db.planExercises.update(entries[n].id, { order: n });
    }
  });
}

export async function updateTargets(db: WorkoutDB, entryId: string, targets: Targets): Promise<void> {
  const t = checkTargets(targets);
  // A member of a superset/circuit does every round, so its sets follow the rounds (W-19).
  const entry = await db.planExercises.get(entryId);
  await db.planExercises.update(entryId, {
    targetSets: entry?.groupKey && entry.groupRounds ? entry.groupRounds : t.targetSets,
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
