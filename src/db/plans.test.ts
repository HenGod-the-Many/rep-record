import { describe, expect, it } from 'vitest';
import {
  addAlternate,
  addEntry,
  createPlan,
  deletePlan,
  duplicatePlan,
  getEntries,
  moveEntry,
  removeAlternate,
  removeEntry,
  replaceEntryExercise,
  updateTargets,
} from './plans';
import { exerciseId, freshDb, planId } from '../test/helpers';
import type { WorkoutDB } from './db';

async function namesIn(db: WorkoutDB, pid: string) {
  const nameOf = new Map((await db.exercises.toArray()).map((e) => [e.id, e.name]));
  return (await getEntries(db, pid)).map((e) => nameOf.get(e.exerciseId));
}

describe('plan builder (R-02.1)', () => {
  it('adds exercises in order with targets', async () => {
    const db = await freshDb();
    const pid = await createPlan(db, 'Arms');
    await addEntry(db, pid, await exerciseId(db, 'Hammer curl'), { targetSets: 3, repMin: 10, repMax: 12 });
    await addEntry(db, pid, await exerciseId(db, 'Plank'), { targetSets: 2, repMin: 30, repMax: 45 });
    const entries = await getEntries(db, pid);
    expect(await namesIn(db, pid)).toEqual(['Hammer curl', 'Plank']);
    expect(entries.map((e) => [e.order, e.targetSets, e.repMin, e.repMax])).toEqual([
      [0, 3, 10, 12],
      [1, 2, 30, 45],
    ]);
  });

  it('moves an entry up and down, and does nothing past either end', async () => {
    const db = await freshDb();
    const pid = await planId(db, 'Push');
    const entries = await getEntries(db, pid);
    await moveEntry(db, entries[2].id, -1); // Machine fly up
    expect((await namesIn(db, pid)).slice(0, 3)).toEqual(['Bench press', 'Machine fly', 'Incline dumbbell press']);
    await moveEntry(db, entries[0].id, -1); // already first
    await moveEntry(db, entries[5].id, 1); // already last
    expect((await namesIn(db, pid))[0]).toBe('Bench press');
    expect((await namesIn(db, pid))[5]).toBe('Rope tricep extensions');
  });

  it('removes an entry and closes the gap in the order', async () => {
    const db = await freshDb();
    const pid = await planId(db, 'Push');
    const entries = await getEntries(db, pid);
    await removeEntry(db, entries[1].id);
    const after = await getEntries(db, pid);
    expect(after.map((e) => e.order)).toEqual([0, 1, 2, 3, 4]);
    expect(await namesIn(db, pid)).not.toContain('Incline dumbbell press');
  });

  it('edits targets and refuses impossible ones', async () => {
    const db = await freshDb();
    const [bench] = await getEntries(db, await planId(db, 'Push'));
    await updateTargets(db, bench.id, { targetSets: 5, repMin: 3, repMax: 5 });
    expect(await db.planExercises.get(bench.id)).toMatchObject({ targetSets: 5, repMin: 3, repMax: 5 });
    await expect(updateTargets(db, bench.id, { targetSets: 3, repMin: 10, repMax: 8 })).rejects.toThrow(/above/);
    await expect(updateTargets(db, bench.id, { targetSets: 0, repMin: 8, repMax: 10 })).rejects.toThrow(/Sets/);
    await expect(updateTargets(db, bench.id, { targetSets: 2.5, repMin: 8, repMax: 10 })).rejects.toThrow(/Sets/);
  });
});

describe('duplicating a plan (R-02.3)', () => {
  it('makes an independent copy', async () => {
    const db = await freshDb();
    const push = await planId(db, 'Push');
    const copy = await duplicatePlan(db, push);
    expect((await db.plans.get(copy))?.name).toBe('Push (copy)');
    expect(await namesIn(db, copy)).toEqual(await namesIn(db, push));

    const copyEntries = await getEntries(db, copy);
    await replaceEntryExercise(db, copyEntries[2].id, await exerciseId(db, 'Cable fly'));
    await updateTargets(db, copyEntries[0].id, { targetSets: 5, repMin: 5, repMax: 5 });
    await removeEntry(db, copyEntries[5].id);

    expect(await namesIn(db, push)).toEqual([
      'Bench press', 'Incline dumbbell press', 'Machine fly',
      'Cable lateral raise', 'Dumbbell skull crushers', 'Rope tricep extensions',
    ]);
    expect((await getEntries(db, push))[0]).toMatchObject({ targetSets: 4, repMin: 6, repMax: 8 });
  });

  it('copies alternates without sharing the list', async () => {
    const db = await freshDb();
    const legs = await planId(db, 'Legs & Abs');
    const copy = await duplicatePlan(db, legs);
    const [copyFirst] = await getEntries(db, copy);
    await removeAlternate(db, copyFirst.id, await exerciseId(db, 'Squat'));
    const [origFirst] = await getEntries(db, legs);
    expect(origFirst.alternateIds).toEqual([await exerciseId(db, 'Squat')]);
  });
});

describe('alternates (R-02.4)', () => {
  it('adds and removes alternates, ignoring duplicates and the main exercise', async () => {
    const db = await freshDb();
    const [bench] = await getEntries(db, await planId(db, 'Push'));
    const dbPress = await exerciseId(db, 'Dumbbell press');
    await addAlternate(db, bench.id, dbPress);
    await addAlternate(db, bench.id, dbPress);
    expect((await db.planExercises.get(bench.id))?.alternateIds).toEqual([dbPress]);
    await expect(addAlternate(db, bench.id, bench.exerciseId)).rejects.toThrow(/main exercise/);
    await removeAlternate(db, bench.id, dbPress);
    expect((await db.planExercises.get(bench.id))?.alternateIds).toEqual([]);
  });
});

describe('permanent swap in a plan (R-04.2)', () => {
  it('changes the plan but leaves the old exercise and its logged sets untouched', async () => {
    const db = await freshDb();
    const push = await planId(db, 'Push');
    const fly = (await getEntries(db, push))[2];
    const machineFly = fly.exerciseId;
    await db.setLogs.add({
      id: 'old', sessionId: 's', exerciseId: machineFly, planExerciseId: fly.id, setNumber: 1,
      weightLb: 100, reps: 12, seconds: null, note: '', loggedAt: 1,
    });

    await replaceEntryExercise(db, fly.id, await exerciseId(db, 'Cable fly'));

    expect((await namesIn(db, push))[2]).toBe('Cable fly');
    expect(await db.exercises.get(machineFly)).toBeDefined();
    expect(await db.setLogs.get('old')).toMatchObject({ exerciseId: machineFly, weightLb: 100, reps: 12 });
  });

  it('drops the new exercise from the alternates if it was one', async () => {
    const db = await freshDb();
    const [legPress] = await getEntries(db, await planId(db, 'Legs & Abs'));
    const squat = await exerciseId(db, 'Squat');
    await replaceEntryExercise(db, legPress.id, squat);
    expect(await db.planExercises.get(legPress.id)).toMatchObject({ exerciseId: squat, alternateIds: [] });
  });
});

describe('deleting a plan', () => {
  it('removes its entries, turns its split days to rest, and keeps logged sets', async () => {
    const db = await freshDb();
    const push = await planId(db, 'Push');
    await db.setLogs.add({
      id: 'keep', sessionId: 's', exerciseId: await exerciseId(db, 'Bench press'), planExerciseId: null,
      setNumber: 1, weightLb: 185, reps: 8, seconds: null, note: '', loggedAt: 1,
    });
    await deletePlan(db, push);
    expect(await db.plans.get(push)).toBeUndefined();
    expect(await db.planExercises.where('planId').equals(push).count()).toBe(0);
    expect(await db.splitDays.filter((d) => d.planId === push).count()).toBe(0);
    expect((await db.splitDays.filter((d) => d.dayIndex === 0).first())?.planId).toBeNull();
    expect(await db.setLogs.get('keep')).toBeDefined();
  });
});
