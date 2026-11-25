import { describe, expect, it } from 'vitest';
import type { PlanExercise } from './db';
import { makeGroup, planBlocks, setGroup, takeOutOfGroup, ungroup } from './groups';
import { addEntry, duplicatePlan, getEntries, moveEntry, removeEntry, updateTargets } from './plans';
import { finishSession, logSet, moveSlot, orderedEntries, startOrResume } from './logging';
import { prefillFor } from './logging';
import { exerciseId, freshDb, planId } from '../test/helpers';
import { addMove, createWarmup, setWarmupRounds, toggleWarmupMove } from './warmups';
import { setPlanWarmup } from './warmups';
import { exportData, readBackup, restoreBackup } from './backup';
import { createExercise } from './exercises';

async function push() {
  const db = await freshDb();
  const id = await planId(db, 'Push');
  const entries = await getEntries(db, id);
  return { db, id, entries };
}
const ids = (es: PlanExercise[]) => es.map((e) => e.id);

describe('groups in plans (R-15.1)', () => {
  it('two exercises in a row become a superset with rounds; each keeps its own targets and does every round', async () => {
    const { db, id, entries } = await push();
    await makeGroup(db, id, [entries[0].id, entries[1].id], 'superset', 3);
    const after = await getEntries(db, id);
    expect(after[0].groupKey).toBeTruthy();
    expect(after[1].groupKey).toBe(after[0].groupKey);
    expect(after.slice(0, 2).map((e) => [e.groupKind, e.groupRounds, e.targetSets])).toEqual([
      ['superset', 3, 3],
      ['superset', 3, 3],
    ]);
    // Own rep ranges are kept.
    expect(after.slice(0, 2).map((e) => [e.repMin, e.repMax])).toEqual(entries.slice(0, 2).map((e) => [e.repMin, e.repMax]));
    const blocks = planBlocks(after);
    expect(blocks[0]).toMatchObject({ type: 'group', kind: 'superset', rounds: 3 });
    expect(blocks[0].type === 'group' && ids(blocks[0].entries)).toEqual(ids(entries.slice(0, 2)));
    expect(blocks.slice(1).every((b) => b.type === 'single')).toBe(true);
  });

  it('refuses one exercise, exercises not in a row, or ones already grouped', async () => {
    const { db, id, entries } = await push();
    await expect(makeGroup(db, id, [entries[0].id], 'superset', 3)).rejects.toThrow('two');
    await expect(makeGroup(db, id, [entries[0].id, entries[2].id], 'superset', 3)).rejects.toThrow('in a row');
    await makeGroup(db, id, [entries[0].id, entries[1].id], 'superset', 3);
    await expect(makeGroup(db, id, [entries[1].id, entries[2].id], 'circuit', 2)).rejects.toThrow('already');
    await expect(makeGroup(db, id, [entries[2].id, entries[3].id], 'circuit', 0)).rejects.toThrow('Rounds');
  });

  it('changing kind or rounds changes every member; ungroup clears it', async () => {
    const { db, id, entries } = await push();
    const key = await makeGroup(db, id, [entries[0].id, entries[1].id, entries[2].id], 'superset', 3);
    await setGroup(db, id, key, 'circuit', 4);
    let after = await getEntries(db, id);
    expect(after.slice(0, 3).map((e) => [e.groupKind, e.groupRounds, e.targetSets])).toEqual([
      ['circuit', 4, 4],
      ['circuit', 4, 4],
      ['circuit', 4, 4],
    ]);
    await ungroup(db, id, key);
    after = await getEntries(db, id);
    expect(after.every((e) => !e.groupKey)).toBe(true);
    expect(planBlocks(after).every((b) => b.type === 'single')).toBe(true);
  });

  it('a member edited on its own still does every round', async () => {
    const { db, id, entries } = await push();
    await makeGroup(db, id, [entries[0].id, entries[1].id], 'superset', 3);
    await updateTargets(db, entries[0].id, { targetSets: 5, repMin: 6, repMax: 6 });
    const e = (await getEntries(db, id))[0];
    expect([e.targetSets, e.repMin]).toEqual([3, 6]);
  });

  it('taking a member out puts it just after the group; a group left with one member dissolves', async () => {
    const { db, id, entries } = await push();
    await makeGroup(db, id, [entries[0].id, entries[1].id, entries[2].id], 'superset', 3);
    await takeOutOfGroup(db, entries[0].id);
    let after = await getEntries(db, id);
    expect(ids(after).slice(0, 3)).toEqual([entries[1].id, entries[2].id, entries[0].id]);
    expect(after[2].groupKey ?? null).toBeNull();
    await takeOutOfGroup(db, entries[1].id);
    after = await getEntries(db, id);
    expect(after.every((e) => !e.groupKey)).toBe(true);
  });

  it('removing a member that leaves one dissolves the group', async () => {
    const { db, id, entries } = await push();
    await makeGroup(db, id, [entries[0].id, entries[1].id], 'superset', 3);
    await removeEntry(db, entries[0].id);
    expect((await getEntries(db, id)).every((e) => !e.groupKey)).toBe(true);
  });

  it('reordering keeps a group whole', async () => {
    const { db, id, entries } = await push();
    const [a, b, c, d] = entries;
    await makeGroup(db, id, [b.id, c.id], 'superset', 3);
    // An ungrouped exercise next to the group jumps over all of it.
    await moveEntry(db, a.id, 1);
    expect(ids(await getEntries(db, id)).slice(0, 4)).toEqual([b.id, c.id, a.id, d.id]);
    await moveEntry(db, a.id, -1);
    expect(ids(await getEntries(db, id)).slice(0, 4)).toEqual([a.id, b.id, c.id, d.id]);
    // A member moves only within its group.
    await moveEntry(db, b.id, 1);
    expect(ids(await getEntries(db, id)).slice(0, 4)).toEqual([a.id, c.id, b.id, d.id]);
    await moveEntry(db, b.id, 1); // last in its group: stays
    expect(ids(await getEntries(db, id)).slice(0, 4)).toEqual([a.id, c.id, b.id, d.id]);
  });

  it('duplicating the plan copies its group, and the copy is independent', async () => {
    const { db, id, entries } = await push();
    const key = await makeGroup(db, id, [entries[0].id, entries[1].id], 'superset', 3);
    const copy = await duplicatePlan(db, id);
    const copied = await getEntries(db, copy);
    expect(planBlocks(copied)[0]).toMatchObject({ type: 'group', kind: 'superset', rounds: 3 });
    await setGroup(db, copy, copied[0].groupKey!, 'circuit', 5);
    const orig = await getEntries(db, id);
    expect([orig[0].groupKind, orig[0].groupRounds, orig[0].groupKey]).toEqual(['superset', 3, key]);
  });
});

describe('logging a group (R-15.2)', () => {
  it('sets logged round by round are saved under each exercise, so pre-fill and history work as usual', async () => {
    const { db, id, entries } = await push();
    const [a, b] = entries;
    await makeGroup(db, id, [a.id, b.id], 'superset', 2);
    const s1 = await startOrResume(db, { date: '2026-11-24', planId: id, time: 'morning' });
    for (const round of [1, 2]) {
      await logSet(db, { sessionId: s1, exerciseId: a.exerciseId, planExerciseId: a.id, setNumber: round, parts: [{ weightLb: 135, reps: 8, seconds: null }] });
      await logSet(db, { sessionId: s1, exerciseId: b.exerciseId, planExerciseId: b.id, setNumber: round, parts: [{ weightLb: 50, reps: 10, seconds: null }] });
    }
    await finishSession(db, s1);
    expect(await db.setLogs.where('exerciseId').equals(a.exerciseId).count()).toBe(2);
    const s2 = await startOrResume(db, { date: '2026-11-26', planId: id, time: 'morning' });
    const pre = await prefillFor(db, s2, b.exerciseId, 2);
    expect(pre.map((p) => [p.weightLb, p.reps])).toEqual([
      [50, 10],
      [50, 10],
    ]);
  });

  it('in a workout a group moves as one block', async () => {
    const { db, id, entries } = await push();
    const [a, b, c, d] = entries;
    await makeGroup(db, id, [b.id, c.id], 'superset', 3);
    const grouped = await getEntries(db, id);
    const s = await startOrResume(db, { date: '2026-11-24', planId: id, time: 'morning' });
    await moveSlot(db, s, grouped, b.id, -1); // the group goes above a
    const order = orderedEntries((await db.sessions.get(s))!, grouped);
    expect(ids(order).slice(0, 4)).toEqual([b.id, c.id, a.id, d.id]);
    await moveSlot(db, s, grouped, d.id, -1); // d jumps over a only
    expect(ids(orderedEntries((await db.sessions.get(s))!, grouped)).slice(0, 4)).toEqual([b.id, c.id, d.id, a.id]);
  });
});

describe('warm-ups with rounds (R-15.3)', () => {
  it('a routine with 2 rounds is copied into the workout and each move is checked in each round', async () => {
    const { db, id } = await push();
    const w = await createWarmup(db, 'Upper');
    await addMove(db, w, { name: 'Arm circles', reps: 10, seconds: null });
    await addMove(db, w, { name: 'Jump rope', reps: null, seconds: 30 });
    await setWarmupRounds(db, w, 2);
    await setPlanWarmup(db, id, w);
    const s = await startOrResume(db, { date: '2026-11-24', planId: id, time: 'morning' });
    expect((await db.sessions.get(s))!.warmupRounds).toBe(2);
    // Round 2's moves are positions 2 and 3.
    for (const i of [0, 1, 2, 3]) await toggleWarmupMove(db, s, i);
    expect((await db.sessions.get(s))!.warmupChecked).toEqual([0, 1, 2, 3]);
    await expect(setWarmupRounds(db, w, 0)).rejects.toThrow('Rounds');
  });
});

describe('circuits from the library (R-15.4)', () => {
  it('a kettlebell exercise and a timed move make a circuit; the timed move logs seconds', async () => {
    const { db, id } = await push();
    const kb = await createExercise(db, { name: 'Kettlebell swing', muscleGroup: 'Hamstrings', equipment: 'Kettlebell', kind: 'weight' });
    const plank = await exerciseId(db, 'Plank');
    const e1 = await addEntry(db, id, kb);
    const e2 = await addEntry(db, id, plank);
    await makeGroup(db, id, [e1, e2], 'circuit', 3);
    const s = await startOrResume(db, { date: '2026-11-24', planId: id, time: 'morning' });
    await logSet(db, { sessionId: s, exerciseId: plank, planExerciseId: e2, setNumber: 1, parts: [{ weightLb: null, reps: null, seconds: 45 }] });
    const set = await db.setLogs.where('exerciseId').equals(plank).first();
    expect(set?.parts[0].seconds).toBe(45);
  });
});

describe('backup', () => {
  it('groups and warm-up rounds survive a backup and restore', async () => {
    const { db, id, entries } = await push();
    await makeGroup(db, id, [entries[0].id, entries[1].id], 'superset', 3);
    const w = await createWarmup(db, 'Upper');
    await setWarmupRounds(db, w, 2);
    const empty = await freshDb({ seed: false });
    const { backup } = readBackup(JSON.stringify(await exportData(db)), empty.verno);
    await restoreBackup(empty, backup);
    expect(planBlocks(await getEntries(empty, id))[0]).toMatchObject({ type: 'group', rounds: 3 });
    expect((await empty.warmups.get(w))?.rounds).toBe(2);
  });
});
