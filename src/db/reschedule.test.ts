import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { getEntries, listPlans, removeEntry } from './plans';
import {
  applyMoveWithinWeek,
  makeDateCopy,
  moveAllFuture,
  previewMoveWithinWeek,
  restore,
  saveCopyAsNewPlan,
  takeSnapshot,
  updatePlanEverywhere,
} from './reschedule';
import { replaceWorkout, resolveDate, resolveRange, scheduleSplit } from './schedule';
import { freshDb, planId } from '../test/helpers';
import type { WorkoutDB } from './db';

const MON = '2026-11-16';
const d = (n: number) => addDays(MON, n);

async function setup() {
  const db = await freshDb();
  const split = (await db.splits.toArray())[0].id;
  await scheduleSplit(db, split, MON, 14);
  return db;
}

async function names(db: WorkoutDB, from: string, days: number) {
  const plans = new Map((await db.plans.toArray()).map((p) => [p.id, p.name]));
  return (await resolveRange(db, from, addDays(from, days))).map((x) =>
    !x.scheduled && !x.overridden ? '—' : x.workouts.length === 0 ? 'Rest' : x.workouts.map((w) => plans.get(w.planId)).join(' + '),
  );
}

const P = 'Push', PL = 'Pull', L = 'Legs & Abs', C = 'Chest, Back, Arms', S = 'Shoulders & Legs', R = 'Rest';

describe('move within the week', () => {
  it("missed Monday, start Tuesday: later workouts shift and Thursday's rest absorbs it", async () => {
    const db = await setup();
    const preview = await previewMoveWithinWeek(db, MON, d(1));
    expect(preview.restBefore).toBe(2);
    expect(preview.restAfter).toBe(1);
    expect(preview.restAlert).toBe(true);
    expect(preview.overflow).toHaveLength(0);
    await applyMoveWithinWeek(db, MON, d(1));
    expect(await names(db, MON, 7)).toEqual([R, P, PL, L, C, S, R]);
    // Next week is untouched.
    expect(await names(db, d(7), 7)).toEqual([P, PL, L, R, C, S, R]);
  });

  it('a move of three days pushes every later workout only as far as needed', async () => {
    const db = await setup();
    const preview = await previewMoveWithinWeek(db, MON, d(2));
    expect(preview.overflow).toHaveLength(0);
    await applyMoveWithinWeek(db, MON, d(2));
    expect(await names(db, MON, 7)).toEqual([R, R, P, PL, L, C, S]);
  });

  it('workouts that do not fit: drop the trailing ones', async () => {
    const db = await setup();
    const preview = await previewMoveWithinWeek(db, MON, d(3));
    expect(preview.overflow.map((u) => u.label)).toEqual([S]);
    await applyMoveWithinWeek(db, MON, d(3), { drop: 'trailing' });
    // Push lands Thursday, Pull Friday, Legs Saturday, CBA Sunday; S&L is dropped.
    expect(await names(db, MON, 7)).toEqual([R, R, R, P, PL, L, C]);
  });

  it('workouts that do not fit: pick which to drop', async () => {
    const db = await setup();
    const preview = await previewMoveWithinWeek(db, MON, d(3));
    const pullIndex = preview.sequence.findIndex((u) => u.label === PL);
    const fixed = await previewMoveWithinWeek(db, MON, d(3), { drop: [pullIndex] });
    expect(fixed.overflow).toHaveLength(0);
    await applyMoveWithinWeek(db, MON, d(3), { drop: [pullIndex] });
    expect(await names(db, MON, 7)).toEqual([R, R, R, P, L, C, S]);
  });

  it('applying a move that still overflows, without a drop choice, is refused', async () => {
    const db = await setup();
    await expect(applyMoveWithinWeek(db, MON, d(3))).rejects.toThrow(/don't fit/);
    expect(await names(db, MON, 7)).toEqual([P, PL, L, R, C, S, R]);
  });

  it('no rest-day alert when dropping keeps the rest days', async () => {
    const db = await setup();
    const seq = (await previewMoveWithinWeek(db, MON, d(1))).sequence;
    const preview = await previewMoveWithinWeek(db, MON, d(1), { drop: [seq.findIndex((u) => u.label === PL)] });
    expect(preview.restAlert).toBe(false);
    expect(preview.after.map((x) => x.label)).toEqual([R, P, L, R, C, S, R]);
  });

  it('what gets saved is exactly what the preview showed, for the same drop choice', async () => {
    const db = await setup();
    const seq = (await previewMoveWithinWeek(db, MON, d(1))).sequence;
    const drop = [seq.findIndex((u) => u.label === PL)];
    const preview = await previewMoveWithinWeek(db, MON, d(1), { drop });
    await applyMoveWithinWeek(db, MON, d(1), { drop });
    expect(await names(db, MON, 7)).toEqual(preview.after.map((x) => x.label));
  });

  it('refuses moving earlier, moving into another week, and moving an empty day', async () => {
    const db = await setup();
    await expect(previewMoveWithinWeek(db, d(2), d(1))).rejects.toThrow(/later/);
    await expect(previewMoveWithinWeek(db, d(5), d(8))).rejects.toThrow(/week/);
    await expect(previewMoveWithinWeek(db, d(3), d(4))).rejects.toThrow(/nothing/i);
  });

  it('a day with two workouts moves as one', async () => {
    const db = await setup();
    const { addWorkoutToDate } = await import('./schedule');
    await addWorkoutToDate(db, MON, await planId(db, 'Pull'), 'evening');
    await applyMoveWithinWeek(db, MON, d(1));
    expect((await names(db, MON, 3))[1]).toBe('Push + Pull');
  });
});

describe('move all future', () => {
  it('everything from the moved day shifts by the same days, rest days kept, end moved out', async () => {
    const db = await setup();
    await moveAllFuture(db, d(2), d(4));
    expect(await names(db, MON, 17)).toEqual([P, PL, R, R, L, R, C, S, R, P, PL, L, R, C, S, R, '—']);
  });

  it('hand-made changes after the moved day move with it; earlier ones stay', async () => {
    const db = await setup();
    await replaceWorkout(db, d(1), 0, await planId(db, 'Legs & Abs')); // before: stays
    await replaceWorkout(db, d(9), 0, await planId(db, 'Pull')); // after: moves by 2
    await moveAllFuture(db, d(2), d(4));
    expect((await names(db, d(1), 1))[0]).toBe(L);
    expect((await names(db, d(11), 1))[0]).toBe(PL);
  });

  it('refuses moving earlier or a date with no schedule', async () => {
    const db = await setup();
    await expect(moveAllFuture(db, d(4), d(2))).rejects.toThrow(/later/);
    await expect(moveAllFuture(db, d(20), d(22))).rejects.toThrow(/schedule/);
  });
});

describe('undo', () => {
  it('restores the calendar exactly as it was before a move', async () => {
    const db = await setup();
    const before = await names(db, MON, 17);
    const snap = await takeSnapshot(db);
    await moveAllFuture(db, d(2), d(4));
    await restore(db, snap);
    expect(await names(db, MON, 17)).toEqual(before);
    const snap2 = await takeSnapshot(db);
    await applyMoveWithinWeek(db, MON, d(1));
    await restore(db, snap2);
    expect(await names(db, MON, 17)).toEqual(before);
  });
});

describe("editing one date's workout", () => {
  it('changes only that date; the plan and other weeks keep every exercise', async () => {
    const db = await setup();
    const push = await planId(db, 'Push');
    const pushCount = (await getEntries(db, push)).length;
    const copy = await makeDateCopy(db, MON, 0);
    expect((await resolveDate(db, MON)).workouts[0].planId).toBe(copy);
    expect((await listPlans(db)).some((p) => p.id === copy)).toBe(false);
    await removeEntry(db, (await getEntries(db, copy))[0].id);
    expect(await getEntries(db, copy)).toHaveLength(pushCount - 1);
    expect(await getEntries(db, push)).toHaveLength(pushCount);
    expect((await resolveDate(db, d(7))).workouts[0].planId).toBe(push);
  });

  it('"update the plan everywhere" writes the changes into the plan', async () => {
    const db = await setup();
    const push = await planId(db, 'Push');
    const copy = await makeDateCopy(db, MON, 0);
    const keep = (await getEntries(db, copy)).slice(1).map((e) => e.exerciseId);
    await removeEntry(db, (await getEntries(db, copy))[0].id);
    await updatePlanEverywhere(db, copy);
    expect((await getEntries(db, push)).map((e) => e.exerciseId)).toEqual(keep);
    expect((await resolveDate(db, MON)).workouts[0].planId).toBe(push);
    expect(await db.plans.get(copy)).toBeUndefined();
  });

  it('"save as a new plan" adds it to the plan list for future splits', async () => {
    const db = await setup();
    const copy = await makeDateCopy(db, MON, 0);
    await removeEntry(db, (await getEntries(db, copy))[0].id);
    await saveCopyAsNewPlan(db, copy, 'Push light');
    const plan = (await listPlans(db)).find((p) => p.name === 'Push light');
    expect(plan?.id).toBe(copy);
    expect((await resolveDate(db, MON)).workouts[0].planId).toBe(copy);
  });
});
