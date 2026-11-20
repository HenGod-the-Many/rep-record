import { describe, expect, it } from 'vitest';
import {
  addMove,
  createWarmup,
  deleteWarmup,
  listWarmups,
  moveAmount,
  plansUsingWarmup,
  removeMove,
  renameWarmup,
  reorderMove,
  setPlanWarmup,
  toggleWarmupMove,
  updateMove,
} from './warmups';
import { startOrResume } from './logging';
import { duplicatePlan } from './plans';
import { makeDateCopy, saveCopyAsNewPlan, updatePlanEverywhere } from './reschedule';
import { addWorkoutToDate } from './schedule';
import { exportData, readBackup, restoreBackup } from './backup';
import { exerciseHistory } from './history';
import type { WorkoutDB } from './db';
import { exerciseId, freshDb, planId } from '../test/helpers';

const reps = (name: string, n: number) => ({ name, reps: n, seconds: null });
const secs = (name: string, n: number) => ({ name, reps: null, seconds: n });

async function pushWithWarmup(db: WorkoutDB) {
  const w = await createWarmup(db, 'Upper warm-up');
  await addMove(db, w, reps('Arm circles', 10));
  await addMove(db, w, secs('Jump rope', 120));
  const push = await planId(db, 'Push');
  await setPlanWarmup(db, push, w);
  return { w, push };
}

describe('building routines (R-14.1)', () => {
  it('a named, ordered list of moves with reps or a time; add, edit, reorder, remove, rename', async () => {
    const db = await freshDb();
    const w = await createWarmup(db, '  Leg   prep ');
    await addMove(db, w, reps('Leg swings', 10));
    await addMove(db, w, secs('Bike', 300));
    await addMove(db, w, reps('Bodyweight squats', 15));
    await reorderMove(db, w, 2, -1);
    await updateMove(db, w, 0, reps('Leg swings', 12));
    await removeMove(db, w, 2);
    await renameWarmup(db, w, 'Leg day prep');
    const [got] = await listWarmups(db);
    expect(got).toEqual({ id: w, name: 'Leg day prep', moves: [reps('Leg swings', 12), reps('Bodyweight squats', 15)] });
  });

  it('refuses a move without a name, with both or neither of reps and time, or with 0', async () => {
    const db = await freshDb();
    const w = await createWarmup(db, 'W');
    await expect(addMove(db, w, reps(' ', 10))).rejects.toThrow('name');
    await expect(addMove(db, w, { name: 'x', reps: 5, seconds: 30 })).rejects.toThrow('either');
    await expect(addMove(db, w, { name: 'x', reps: null, seconds: null })).rejects.toThrow('either');
    await expect(addMove(db, w, reps('x', 0))).rejects.toThrow('above 0');
    await expect(addMove(db, w, secs('x', 2.5))).rejects.toThrow('1 second');
    await expect(createWarmup(db, '')).rejects.toThrow('name');
  });

  it('lists routines alphabetically, ignoring capitals', async () => {
    const db = await freshDb();
    await createWarmup(db, 'Upper');
    await createWarmup(db, 'arm day');
    await createWarmup(db, 'Legs');
    expect((await listWarmups(db)).map((w) => w.name)).toEqual(['arm day', 'Legs', 'Upper']);
  });

  it('reordering past either end does nothing', async () => {
    const db = await freshDb();
    const w = await createWarmup(db, 'W');
    await addMove(db, w, reps('a', 1));
    await addMove(db, w, reps('b', 1));
    await reorderMove(db, w, 0, -1);
    await reorderMove(db, w, 1, 1);
    expect((await listWarmups(db))[0].moves.map((m) => m.name)).toEqual(['a', 'b']);
  });

  it('shows amounts as reps or minutes and seconds', () => {
    expect(moveAmount(reps('a', 10))).toBe('10 reps');
    expect(moveAmount(reps('a', 1))).toBe('1 rep');
    expect(moveAmount(secs('a', 120))).toBe('2 min');
    expect(moveAmount(secs('a', 45))).toBe('45 s');
    expect(moveAmount(secs('a', 90))).toBe('1 min 30 s');
  });
});

describe('attaching to plans (R-14.2)', () => {
  it('one routine on many plans; deleting it detaches it after naming the plans', async () => {
    const db = await freshDb();
    const { w, push } = await pushWithWarmup(db);
    await setPlanWarmup(db, await planId(db, 'Pull'), w);
    expect(await plansUsingWarmup(db, w)).toEqual(['Pull', 'Push']);
    await deleteWarmup(db, w);
    expect((await db.plans.get(push))?.warmupId).toBeNull();
    expect(await listWarmups(db)).toEqual([]);
  });

  it('duplicate, a one-date edit, save as a new plan, and update everywhere all keep the warm-up', async () => {
    const db = await freshDb();
    const { w, push } = await pushWithWarmup(db);
    const dup = await duplicatePlan(db, push);
    expect((await db.plans.get(dup))?.warmupId).toBe(w);

    await addWorkoutToDate(db, '2026-11-20', push, 'morning');
    const copy = await makeDateCopy(db, '2026-11-20', 0);
    expect((await db.plans.get(copy))?.warmupId).toBe(w);
    await saveCopyAsNewPlan(db, copy, 'Push B');
    expect((await db.plans.get(copy))?.warmupId).toBe(w);

    // A date's copy with a different warm-up: "update everywhere" carries it to the plan.
    await addWorkoutToDate(db, '2026-11-21', push, 'morning');
    const copy2 = await makeDateCopy(db, '2026-11-21', 0);
    const other = await createWarmup(db, 'Short');
    await setPlanWarmup(db, copy2, other);
    await updatePlanEverywhere(db, copy2);
    expect((await db.plans.get(push))?.warmupId).toBe(other);

    // A copy from before warm-ups existed (no field at all) leaves the plan's warm-up alone.
    await addWorkoutToDate(db, '2026-11-22', push, 'morning');
    const old = await makeDateCopy(db, '2026-11-22', 0);
    await db.plans.where('id').equals(old).modify((p) => { delete p.warmupId; });
    await updatePlanEverywhere(db, old);
    expect((await db.plans.get(push))?.warmupId).toBe(other);
  });
});

describe('in the workout (R-14.2)', () => {
  it('starting the workout copies the moves; each is checked off with one tap and unchecked with another', async () => {
    const db = await freshDb();
    const { push } = await pushWithWarmup(db);
    const s = await startOrResume(db, { date: '2026-11-20', planId: push, time: 'morning' });
    expect((await db.sessions.get(s))?.warmupMoves).toEqual([reps('Arm circles', 10), secs('Jump rope', 120)]);
    await toggleWarmupMove(db, s, 1);
    await toggleWarmupMove(db, s, 0);
    expect((await db.sessions.get(s))?.warmupChecked).toEqual([0, 1]);
    await toggleWarmupMove(db, s, 0);
    expect((await db.sessions.get(s))?.warmupChecked).toEqual([1]);
  });

  it('editing the routine later does not change a workout already started', async () => {
    const db = await freshDb();
    const { w, push } = await pushWithWarmup(db);
    const s = await startOrResume(db, { date: '2026-11-20', planId: push, time: 'morning' });
    await removeMove(db, w, 0);
    await deleteWarmup(db, w);
    expect((await db.sessions.get(s))?.warmupMoves).toHaveLength(2);
  });

  it('a plan with no warm-up starts with none', async () => {
    const db = await freshDb();
    const s = await startOrResume(db, { date: '2026-11-20', planId: await planId(db, 'Pull'), time: 'morning' });
    expect((await db.sessions.get(s))?.warmupMoves).toEqual([]);
  });

  it('warm-up moves never appear in exercise history', async () => {
    const db = await freshDb();
    const { push } = await pushWithWarmup(db);
    const s = await startOrResume(db, { date: '2026-11-20', planId: push, time: 'morning' });
    await toggleWarmupMove(db, s, 0);
    expect(await exerciseHistory(db, await exerciseId(db, 'Bench press'))).toEqual([]);
    expect(await db.setLogs.count()).toBe(0);
  });
});

describe('backup', () => {
  it('routines, plan links and checks go into the backup and come back', async () => {
    const db = await freshDb();
    const { w, push } = await pushWithWarmup(db);
    const s = await startOrResume(db, { date: '2026-11-20', planId: push, time: 'morning' });
    await toggleWarmupMove(db, s, 1);
    const file = JSON.stringify(await exportData(db));
    const other = await freshDb({ seed: false });
    await restoreBackup(other, readBackup(file, other.verno).backup);
    expect((await other.warmups.get(w))?.moves).toHaveLength(2);
    expect((await other.plans.get(push))?.warmupId).toBe(w);
    expect((await other.sessions.get(s))?.warmupChecked).toEqual([1]);
  });
});
