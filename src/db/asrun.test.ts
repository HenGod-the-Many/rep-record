import { describe, expect, it } from 'vitest';
import type { PlanExercise, SetLog } from './db';
import { exportData, readBackup, restoreBackup } from './backup';
import { getEntries } from './plans';
import { finishSession, logSet, moveSlot, orderedEntries, slotDone, startOrResume } from './logging';
import { foldedByDefault, foldSummary } from './fold';
import { freshDb, planId } from '../test/helpers';

async function pushWorkout() {
  const db = await freshDb();
  const push = await planId(db, 'Push');
  const sessionId = await startOrResume(db, { date: '2026-11-24', planId: push, time: 'morning' });
  const entries = await getEntries(db, push);
  return { db, push, sessionId, entries };
}

const ids = (list: PlanExercise[]) => list.map((e) => e.id);

describe('as-run order (R-05.11)', () => {
  it('a new workout follows the plan order', async () => {
    const { db, sessionId, entries } = await pushWorkout();
    const s = (await db.sessions.get(sessionId))!;
    expect(ids(orderedEntries(s, entries))).toEqual(ids(entries));
  });

  it('moving the third exercise up twice puts it first, on this workout only', async () => {
    const { db, push, sessionId, entries } = await pushWorkout();
    const third = entries[2].id;
    await moveSlot(db, sessionId, entries, third, -1);
    await moveSlot(db, sessionId, entries, third, -1);
    const s = (await db.sessions.get(sessionId))!;
    expect(ids(orderedEntries(s, entries))).toEqual([third, entries[0].id, entries[1].id, ...ids(entries.slice(3))]);
    // The plan is unchanged.
    expect(ids(await getEntries(db, push))).toEqual(ids(entries));
  });

  it("the next workout of the same plan uses the plan's order", async () => {
    const { db, push, sessionId, entries } = await pushWorkout();
    await moveSlot(db, sessionId, entries, entries[2].id, -1);
    await finishSession(db, sessionId);
    const next = await startOrResume(db, { date: '2026-12-01', planId: push, time: 'morning' });
    const s = (await db.sessions.get(next))!;
    expect(ids(orderedEntries(s, await getEntries(db, push)))).toEqual(ids(entries));
  });

  it('moving the first up or the last down changes nothing', async () => {
    const { db, sessionId, entries } = await pushWorkout();
    await moveSlot(db, sessionId, entries, entries[0].id, -1);
    await moveSlot(db, sessionId, entries, entries[entries.length - 1].id, 1);
    const s = (await db.sessions.get(sessionId))!;
    expect(ids(orderedEntries(s, entries))).toEqual(ids(entries));
  });

  it('a slot added to the plan after a move goes at the end; a removed slot drops out', async () => {
    const { db, sessionId, entries } = await pushWorkout();
    await moveSlot(db, sessionId, entries, entries[2].id, -1); // order: 0, 2, 1, 3...
    const s = (await db.sessions.get(sessionId))!;
    const added = { ...entries[0], id: 'new-slot', order: 99 };
    const changed = [...entries.slice(1), added]; // first slot removed, one added
    expect(ids(orderedEntries(s, changed))).toEqual([entries[2].id, entries[1].id, ...ids(entries.slice(3)), 'new-slot']);
  });

  it('the order survives a backup and restore', async () => {
    const { db, sessionId, entries } = await pushWorkout();
    await moveSlot(db, sessionId, entries, entries[2].id, -1);
    const order = (await db.sessions.get(sessionId))!.slotOrder;
    expect(order?.length).toBe(entries.length);
    const empty = await freshDb({ seed: false });
    const { backup } = readBackup(JSON.stringify(await exportData(db)), empty.verno);
    await restoreBackup(empty, backup);
    expect((await empty.sessions.get(sessionId))!.slotOrder).toEqual(order);
  });
});

const log = (setNumber: number, weightLb: number | null, reps: number | null, seconds: number | null = null): SetLog => ({
  id: `s${setNumber}`,
  sessionId: 'x',
  exerciseId: 'e',
  planExerciseId: 'p',
  setNumber,
  parts: [{ weightLb, reps, seconds }],
  difficulty: null,
  toFailure: false,
  note: '',
  loggedAt: setNumber,
});

describe('folding finished exercises (R-05.12)', () => {
  it('an exercise is done when every target set is logged', async () => {
    const { db, sessionId, entries } = await pushWorkout();
    const entry = entries[0];
    const ex = entry.exerciseId;
    for (let n = 1; n < entry.targetSets; n++) {
      await logSet(db, { sessionId, exerciseId: ex, planExerciseId: entry.id, setNumber: n, parts: [{ weightLb: 135, reps: 8, seconds: null }] });
    }
    const logs = () => db.setLogs.where('sessionId').equals(sessionId).toArray();
    expect(slotDone(entry, await logs(), 'weight')).toBe(false);
    await logSet(db, { sessionId, exerciseId: ex, planExerciseId: entry.id, setNumber: entry.targetSets, parts: [{ weightLb: 135, reps: 8, seconds: null }] });
    expect(slotDone(entry, await logs(), 'weight')).toBe(true);
  });

  it('an activity is done once it is logged', () => {
    const entry = { targetSets: 1 } as PlanExercise;
    expect(slotDone(entry, [], 'activity')).toBe(false);
    expect(slotDone(entry, [log(1, null, null, 1800)], 'activity')).toBe(true);
  });

  it('the one-line summary names the sets and the best set', () => {
    // Heaviest wins; a tie on weight goes to more reps.
    expect(foldSummary('Bench press', 'weight', [log(1, 185, 6), log(2, 185, 8), log(3, 175, 10)], 'lb')).toBe('Bench press · 3 sets · best 185 lb × 8');
    expect(foldSummary('Pull-up', 'bodyweight', [log(1, null, 10), log(2, null, 12)], 'lb')).toBe('Pull-up · 2 sets · best 12 reps');
    expect(foldSummary('Plank', 'timed', [log(1, null, null, 45), log(2, null, null, 60)], 'lb')).toBe('Plank · 2 sets · best 60 s');
    expect(foldSummary('Squat', 'weight', [log(1, 225, 5)], 'lb')).toBe('Squat · 1 set · best 225 lb × 5');
  });

  it('a set with a mid-set weight change counts its heaviest part', () => {
    const changed: SetLog = { ...log(1, 135, 5), parts: [{ weightLb: 135, reps: 5, seconds: null }, { weightLb: 115, reps: 3, seconds: null }] };
    expect(foldSummary('Bench press', 'weight', [changed, log(2, 130, 8)], 'lb')).toBe('Bench press · 2 sets · best 135 lb × 5');
  });
});

describe('when a finished exercise folds by itself (R-05.12)', () => {
  const none = new Set<string>();
  it('an unfinished exercise never folds', () => {
    expect(foldedByDefault('a', false, new Set(['a']), 'b')).toBe(false);
  });
  it('finished when the screen opened: folded', () => {
    expect(foldedByDefault('a', true, new Set(['a']), null)).toBe(true);
  });
  it('just finished, last set still being rated: open', () => {
    expect(foldedByDefault('a', true, none, 'a')).toBe(false);
  });
  it('finished, then a set is logged in another exercise: folded, even unrated or logged out of order', () => {
    expect(foldedByDefault('a', true, none, 'b')).toBe(true);
  });
});
