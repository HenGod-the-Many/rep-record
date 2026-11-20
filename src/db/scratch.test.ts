import { describe, expect, it } from 'vitest';
import { addEntry, getEntries, listPlans } from './plans';
import { createDateWorkout, pruneUnusedCopies, saveCopyAsNewPlan } from './reschedule';
import { addWorkoutToDate, resolveDate, scheduleSplit } from './schedule';
import { exerciseId, freshDb, planId } from '../test/helpers';

describe('building a workout from scratch on a date', () => {
  it('works on a day with nothing scheduled: an empty workout at the chosen time, not listed with the plans', async () => {
    const db = await freshDb();
    const id = await createDateWorkout(db, '2026-11-20', 'evening');
    const day = await resolveDate(db, '2026-11-20');
    expect(day.workouts).toEqual([{ planId: id, time: 'evening' }]);
    expect(await getEntries(db, id)).toEqual([]);
    expect((await listPlans(db)).map((p) => p.id)).not.toContain(id);
    expect(await db.plans.get(id)).toMatchObject({ name: 'New workout', hidden: true, sourcePlanId: null });
  });

  it('is added alongside what the split already puts on that day', async () => {
    const db = await freshDb();
    const split = (await db.splits.toArray())[0];
    await scheduleSplit(db, split.id, '2026-11-16', 28); // Mon 16 Nov = day 1, Push
    const id = await createDateWorkout(db, '2026-11-16', '18:30');
    const day = await resolveDate(db, '2026-11-16');
    expect(day.workouts.map((w) => w.planId)).toEqual([await planId(db, 'Push'), id]);
  });

  it('can be added next to another workout added by hand', async () => {
    const db = await freshDb();
    await addWorkoutToDate(db, '2026-11-20', await planId(db, 'Pull'), 'morning');
    const id = await createDateWorkout(db, '2026-11-20', 'night');
    expect((await resolveDate(db, '2026-11-20')).workouts.map((w) => w.planId)).toEqual([await planId(db, 'Pull'), id]);
  });

  it('keeps its exercises, survives the start-up clean-up, and can be saved as a plan', async () => {
    const db = await freshDb();
    const id = await createDateWorkout(db, '2026-11-20', 'morning');
    await addEntry(db, id, await exerciseId(db, 'Squat'));
    expect(await pruneUnusedCopies(db)).toBe(0);
    expect((await getEntries(db, id)).length).toBe(1);
    await saveCopyAsNewPlan(db, id, 'Leg day B');
    expect((await listPlans(db)).find((p) => p.id === id)?.name).toBe('Leg day B');
  });

  it('refuses an impossible date or a blank name', async () => {
    const db = await freshDb();
    await expect(createDateWorkout(db, '2026-02-30', 'morning')).rejects.toThrow();
    await expect(createDateWorkout(db, '2026-11-20', 'morning', '  ')).rejects.toThrow('name');
  });
});
