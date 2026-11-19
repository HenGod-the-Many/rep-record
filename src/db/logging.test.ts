import { describe, expect, it } from 'vitest';
import type { WorkoutDB } from './db';
import { addAlternate, getEntries } from './plans';
import { makeDateCopy, updatePlanEverywhere } from './reschedule';
import { addWorkoutToDate } from './schedule';
import {
  activeExerciseId,
  adjustSet,
  changeWeightAt,
  deleteSet,
  findSession,
  finishSession,
  logSet,
  prefillFor,
  reopenSession,
  setDifficulty,
  setsFor,
  setTotalReps,
  startOrResume,
  swapChoices,
  swapForSession,
  updateSetParts,
} from './logging';
import { exerciseId, freshDb, planId } from '../test/helpers';

const W = (weightLb: number | null, reps: number | null) => ({ weightLb, reps, seconds: null });

async function pushSession(db: WorkoutDB, date = '2026-11-19', time = 'morning') {
  const push = await planId(db, 'Push');
  const sessionId = await startOrResume(db, { date, planId: push, time });
  const entries = await getEntries(db, push);
  return { push, sessionId, entries };
}

describe('starting a workout', () => {
  it('creates an open session, and starting again the same day resumes it', async () => {
    const db = await freshDb();
    const { push, sessionId } = await pushSession(db);
    const s = await db.sessions.get(sessionId);
    expect(s).toMatchObject({ date: '2026-11-19', time: 'morning', planId: push, planName: 'Push', finishedAt: null, swaps: {} });
    expect(await startOrResume(db, { date: '2026-11-19', planId: push, time: 'morning' })).toBe(sessionId);
    expect(await db.sessions.count()).toBe(1);
  });

  it('keeps two workouts of the same plan on one day apart by time', async () => {
    const db = await freshDb();
    const push = await planId(db, 'Push');
    const times = ['morning', 'evening'];
    const a = await startOrResume(db, { date: '2026-11-19', planId: push, time: 'morning', plannedTimes: times });
    const b = await startOrResume(db, { date: '2026-11-19', planId: push, time: 'evening', plannedTimes: times });
    expect(a).not.toBe(b);
    expect(await db.sessions.count()).toBe(2);
  });

  it('resumes the same session when the workout time was changed after starting', async () => {
    const db = await freshDb();
    const push = await planId(db, 'Push');
    const a = await startOrResume(db, { date: '2026-11-19', planId: push, time: 'morning' });
    const b = await startOrResume(db, { date: '2026-11-19', planId: push, time: '17:30', plannedTimes: ['17:30'] });
    expect(b).toBe(a);
    expect((await db.sessions.get(a))?.time).toBe('17:30');
  });

  it('a different day is a new session', async () => {
    const db = await freshDb();
    const { push, sessionId } = await pushSession(db);
    expect(await startOrResume(db, { date: '2026-11-20', planId: push, time: 'morning' })).not.toBe(sessionId);
  });

  it('finishing marks it done; reopening makes it open again', async () => {
    const db = await freshDb();
    const { push, sessionId } = await pushSession(db);
    await finishSession(db, sessionId);
    expect((await findSession(db, { date: '2026-11-19', planId: push, time: 'morning' }))?.finishedAt).toEqual(expect.any(Number));
    await reopenSession(db, sessionId);
    expect((await db.sessions.get(sessionId))?.finishedAt).toBeNull();
  });
});

describe('logging sets', () => {
  it('saves a set at once with difficulty blank and not to failure', async () => {
    const db = await freshDb();
    const { sessionId, entries } = await pushSession(db);
    const bench = entries[0];
    const id = await logSet(db, { sessionId, exerciseId: bench.exerciseId, planExerciseId: bench.id, setNumber: 1, parts: [W(135, 8)] });
    expect(await db.setLogs.get(id)).toMatchObject({ setNumber: 1, parts: [W(135, 8)], difficulty: null, toFailure: false });
  });

  it('logging the same set number again updates it instead of adding a duplicate', async () => {
    const db = await freshDb();
    const { sessionId, entries } = await pushSession(db);
    const bench = entries[0];
    const base = { sessionId, exerciseId: bench.exerciseId, planExerciseId: bench.id, setNumber: 1 };
    const a = await logSet(db, { ...base, parts: [W(135, 8)] });
    const b = await logSet(db, { ...base, parts: [W(140, 8)] });
    expect(b).toBe(a);
    expect(await db.setLogs.count()).toBe(1);
    expect((await db.setLogs.get(a))?.parts).toEqual([W(140, 8)]);
  });

  it('refuses a weight set without weight or reps, and a timed set without seconds', async () => {
    const db = await freshDb();
    const { sessionId, entries } = await pushSession(db);
    const bench = entries[0];
    const base = { sessionId, exerciseId: bench.exerciseId, planExerciseId: bench.id, setNumber: 1 };
    await expect(logSet(db, { ...base, parts: [W(null, 8)] })).rejects.toThrow('weight');
    await expect(logSet(db, { ...base, parts: [W(135, null)] })).rejects.toThrow('reps');
    const plank = await exerciseId(db, 'Plank');
    await expect(logSet(db, { sessionId, exerciseId: plank, planExerciseId: null, setNumber: 1, parts: [W(null, null)] })).rejects.toThrow('seconds');
  });

  it('logs the three kinds: weight × reps, bodyweight reps with optional added weight, timed seconds', async () => {
    const db = await freshDb();
    const { sessionId } = await pushSession(db);
    const dips = await exerciseId(db, 'Hanging leg raise');
    const plank = await exerciseId(db, 'Plank');
    const a = await logSet(db, { sessionId, exerciseId: dips, planExerciseId: null, setNumber: 1, parts: [W(null, 12)] });
    const b = await logSet(db, { sessionId, exerciseId: dips, planExerciseId: null, setNumber: 2, parts: [W(25, 8)] });
    const c = await logSet(db, { sessionId, exerciseId: plank, planExerciseId: null, setNumber: 1, parts: [{ weightLb: null, reps: null, seconds: 60 }] });
    expect((await db.setLogs.get(a))?.parts).toEqual([W(null, 12)]);
    expect((await db.setLogs.get(b))?.parts).toEqual([W(25, 8)]);
    expect((await db.setLogs.get(c))?.parts).toEqual([{ weightLb: null, reps: null, seconds: 60 }]);
  });

  it('difficulty is 1 to 10 or blank, and can be changed', async () => {
    const db = await freshDb();
    const { sessionId, entries } = await pushSession(db);
    const bench = entries[0];
    const id = await logSet(db, { sessionId, exerciseId: bench.exerciseId, planExerciseId: bench.id, setNumber: 1, parts: [W(135, 8)] });
    await setDifficulty(db, id, 8);
    expect((await db.setLogs.get(id))?.difficulty).toBe(8);
    await setDifficulty(db, id, 7);
    expect((await db.setLogs.get(id))?.difficulty).toBe(7);
    await setDifficulty(db, id, null);
    expect((await db.setLogs.get(id))?.difficulty).toBeNull();
    await expect(setDifficulty(db, id, 11)).rejects.toThrow('1 to 10');
    await expect(setDifficulty(db, id, 0)).rejects.toThrow('1 to 10');
  });

  it('deleting a set moves the later sets up one number', async () => {
    const db = await freshDb();
    const { sessionId, entries } = await pushSession(db);
    const bench = entries[0];
    const base = { sessionId, exerciseId: bench.exerciseId, planExerciseId: bench.id };
    await logSet(db, { ...base, setNumber: 1, parts: [W(135, 8)] });
    const two = await logSet(db, { ...base, setNumber: 2, parts: [W(140, 8)] });
    await logSet(db, { ...base, setNumber: 3, parts: [W(145, 6)] });
    await deleteSet(db, two);
    const left = await setsFor(db, sessionId, bench.exerciseId, bench.id);
    expect(left.map((l) => [l.setNumber, l.parts[0].weightLb])).toEqual([[1, 135], [2, 145]]);
  });

  it('editing a logged set changes its numbers', async () => {
    const db = await freshDb();
    const { sessionId, entries } = await pushSession(db);
    const bench = entries[0];
    const id = await logSet(db, { sessionId, exerciseId: bench.exerciseId, planExerciseId: bench.id, setNumber: 1, parts: [W(135, 8)] });
    await updateSetParts(db, id, [W(140, 7)]);
    expect((await db.setLogs.get(id))?.parts).toEqual([W(140, 7)]);
    await expect(updateSetParts(db, id, [W(140, 0)])).rejects.toThrow('reps');
  });
});

describe('weight change, rep change and failed', () => {
  it('weight change at rep 6 of 8, 135 -> 115: 5 × 135 then 3 × 115', () => {
    expect(changeWeightAt([W(135, 8)], 6, 115)).toEqual([W(135, 5), W(115, 3)]);
  });

  it('a set can change weight more than once', () => {
    const once = changeWeightAt([W(135, 8)], 6, 115);
    expect(changeWeightAt(once, 7, 95)).toEqual([W(135, 5), W(115, 1), W(95, 2)]);
  });

  it('changing at rep 1 puts the whole set at the new weight', () => {
    expect(changeWeightAt([W(135, 8)], 1, 115)).toEqual([W(115, 8)]);
  });

  it('refuses a rep outside the set', () => {
    expect(() => changeWeightAt([W(135, 8)], 9, 115)).toThrow('1 to 8');
    expect(() => changeWeightAt([W(135, 8)], 0, 115)).toThrow();
  });

  it('only the chosen set changes; the others keep their weight and reps', async () => {
    const db = await freshDb();
    const { sessionId, entries } = await pushSession(db);
    const bench = entries[0];
    const base = { sessionId, exerciseId: bench.exerciseId, planExerciseId: bench.id };
    for (const n of [1, 2]) await logSet(db, { ...base, setNumber: n, parts: [W(135, 8)] });
    // Set 3 not yet logged: applying the change logs it with the change.
    await logSet(db, { ...base, setNumber: 3, parts: changeWeightAt([W(135, 8)], 6, 115) });
    const sets = await setsFor(db, sessionId, bench.exerciseId, bench.id);
    expect(sets.map((s) => s.parts)).toEqual([[W(135, 8)], [W(135, 8)], [W(135, 5), W(115, 3)]]);
  });

  it('rep change sets the total; fewer trims from the end, more go on the last part', () => {
    expect(setTotalReps([W(135, 8)], 6)).toEqual([W(135, 6)]);
    expect(setTotalReps([W(135, 5), W(115, 3)], 6)).toEqual([W(135, 5), W(115, 1)]);
    expect(setTotalReps([W(135, 5), W(115, 3)], 4)).toEqual([W(135, 4)]);
    expect(setTotalReps([W(135, 5), W(115, 3)], 10)).toEqual([W(135, 5), W(115, 5)]);
    expect(setTotalReps([W(135, null)], 8)).toEqual([W(135, 8)]);
  });

  it('failed: aiming for 10, got 8 -> 8 reps marked to failure', async () => {
    const db = await freshDb();
    const { sessionId, entries } = await pushSession(db);
    const bench = entries[0];
    const id = await logSet(db, {
      sessionId, exerciseId: bench.exerciseId, planExerciseId: bench.id, setNumber: 1,
      parts: setTotalReps([W(135, 10)], 8), toFailure: true,
    });
    expect(await db.setLogs.get(id)).toMatchObject({ parts: [W(135, 8)], toFailure: true });
  });
});

describe('pre-fill', () => {
  it('is empty the first time', async () => {
    const db = await freshDb();
    const { sessionId, entries } = await pushSession(db);
    expect(await prefillFor(db, sessionId, entries[0].exerciseId, 4)).toEqual([]);
  });

  it('row n uses set n of the last session, in any plan; extra rows use the last set', async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    // Last time Bench press was done in a different plan.
    const other = await startOrResume(db, { date: '2026-11-15', planId: await planId(db, 'Pull'), time: 'morning' });
    const base = { sessionId: other, exerciseId: bench, planExerciseId: null };
    await logSet(db, { ...base, setNumber: 1, parts: [W(135, 8)], difficulty: 7 });
    await logSet(db, { ...base, setNumber: 2, parts: [W(145, 6)], difficulty: 8, toFailure: true });

    const { sessionId } = await pushSession(db);
    const rows = await prefillFor(db, sessionId, bench, 4);
    expect(rows.map((r) => [r.weightLb, r.reps])).toEqual([[135, 8], [145, 6], [145, 6], [145, 6]]);
    expect(rows[1].last).toMatchObject({ difficulty: 8, toFailure: true });
  });

  it('uses the most recent earlier session, not today\'s sets or older ones', async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    const push = await planId(db, 'Push');
    const old = await startOrResume(db, { date: '2026-11-01', planId: push, time: 'morning' });
    await logSet(db, { sessionId: old, exerciseId: bench, planExerciseId: null, setNumber: 1, parts: [W(115, 8)] });
    const recent = await startOrResume(db, { date: '2026-11-12', planId: push, time: 'morning' });
    await logSet(db, { sessionId: recent, exerciseId: bench, planExerciseId: null, setNumber: 1, parts: [W(125, 8)] });
    const today = await startOrResume(db, { date: '2026-11-19', planId: push, time: 'morning' });
    await logSet(db, { sessionId: today, exerciseId: bench, planExerciseId: null, setNumber: 1, parts: [W(135, 8)] });
    expect((await prefillFor(db, today, bench, 1))[0].weightLb).toBe(125);
  });

  it('a set with a weight change pre-fills its starting weight and total reps', async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    const push = await planId(db, 'Push');
    const old = await startOrResume(db, { date: '2026-11-12', planId: push, time: 'morning' });
    await logSet(db, { sessionId: old, exerciseId: bench, planExerciseId: null, setNumber: 1, parts: [W(135, 5), W(115, 3)] });
    const today = await startOrResume(db, { date: '2026-11-19', planId: push, time: 'morning' });
    expect((await prefillFor(db, today, bench, 1))[0]).toMatchObject({ weightLb: 135, reps: 8 });
  });
});

describe('session-only swap', () => {
  it('logs the substitute under its own id with the slot recorded; the plan is unchanged', async () => {
    const db = await freshDb();
    const { push, sessionId, entries } = await pushSession(db);
    const fly = entries[2]; // Machine fly
    const cableFly = await exerciseId(db, 'Cable fly');
    const original = fly.exerciseId;
    // A set logged before the swap stays under the original.
    await logSet(db, { sessionId, exerciseId: original, planExerciseId: fly.id, setNumber: 1, parts: [W(100, 12)] });

    await swapForSession(db, sessionId, fly, cableFly);
    const session = (await db.sessions.get(sessionId))!;
    expect(activeExerciseId(session, fly)).toBe(cableFly);
    await logSet(db, { sessionId, exerciseId: cableFly, planExerciseId: fly.id, setNumber: 1, parts: [W(30, 12)] });

    expect((await getEntries(db, push)).find((e) => e.id === fly.id)?.exerciseId).toBe(original);
    expect((await setsFor(db, sessionId, original, fly.id)).length).toBe(1);
    expect((await setsFor(db, sessionId, cableFly, fly.id))[0]).toMatchObject({ exerciseId: cableFly, planExerciseId: fly.id });
  });

  it('the swap survives closing the app before any set is logged, and swapping back clears it', async () => {
    const db = await freshDb();
    const { sessionId, entries } = await pushSession(db);
    const slot = entries[2];
    const cableFly = await exerciseId(db, 'Cable fly');
    await swapForSession(db, sessionId, slot, cableFly);
    expect((await db.sessions.get(sessionId))?.swaps).toEqual({ [slot.id]: cableFly });
    await swapForSession(db, sessionId, slot, slot.exerciseId);
    expect((await db.sessions.get(sessionId))?.swaps).toEqual({});
  });

  it('offers the slot\'s alternates first, then the active library without archived exercises', async () => {
    const db = await freshDb();
    const { push, entries } = await pushSession(db);
    await addAlternate(db, entries[2].id, await exerciseId(db, 'Cable fly'));
    const slot = (await getEntries(db, push))[2];
    const archived = (await db.exercises.toArray()).find((e) => e.id !== slot.exerciseId && !slot.alternateIds.includes(e.id))!;
    await db.exercises.update(archived.id, { archived: true });
    const { alternates, others } = await swapChoices(db, slot, slot.exerciseId);
    expect(alternates.map((e) => e.id)).toEqual(slot.alternateIds);
    expect(others.map((e) => e.id)).not.toContain(archived.id);
    expect(others.map((e) => e.id)).not.toContain(slot.exerciseId);
    expect(others.length).toBeGreaterThan(20);
  });
});

describe('fixes from the bug review', () => {
  it('pre-fill for an older workout never uses a later one', async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    const push = await planId(db, 'Push');
    const mon = await startOrResume(db, { date: '2026-11-16', planId: push, time: 'morning' });
    await logSet(db, { sessionId: mon, exerciseId: bench, planExerciseId: null, setNumber: 1, parts: [W(125, 8)] });
    const thu = await startOrResume(db, { date: '2026-11-19', planId: push, time: 'morning' });
    await logSet(db, { sessionId: thu, exerciseId: bench, planExerciseId: null, setNumber: 1, parts: [W(135, 8)] });
    expect(await prefillFor(db, mon, bench, 1)).toEqual([]);
    expect((await prefillFor(db, thu, bench, 1))[0].weightLb).toBe(125);
  });

  it('when the exercise filled two slots last time, pre-fill uses one slot, not both mixed', async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    const push = await planId(db, 'Push');
    const old = await startOrResume(db, { date: '2026-11-12', planId: push, time: 'morning' });
    for (const n of [1, 2, 3]) await logSet(db, { sessionId: old, exerciseId: bench, planExerciseId: 'slotA', setNumber: n, parts: [W(135, 8)] });
    await logSet(db, { sessionId: old, exerciseId: bench, planExerciseId: 'slotB', setNumber: 1, parts: [W(95, 15)] });
    const today = await startOrResume(db, { date: '2026-11-19', planId: push, time: 'morning' });
    expect((await prefillFor(db, today, bench, 3)).map((r) => r.weightLb)).toEqual([135, 135, 135]);
  });

  it('two quick ± taps on a logged set both count', async () => {
    const db = await freshDb();
    const { sessionId, entries } = await pushSession(db);
    const bench = entries[0];
    const id = await logSet(db, { sessionId, exerciseId: bench.exerciseId, planExerciseId: bench.id, setNumber: 1, parts: [W(135, 8)] });
    const plus5 = (p: { weightLb: number | null; reps: number | null; seconds: number | null }) => ({ ...p, weightLb: (p.weightLb ?? 0) + 5 });
    await Promise.all([adjustSet(db, id, plus5), adjustSet(db, id, plus5)]);
    expect((await db.setLogs.get(id))?.parts[0].weightLb).toBe(145);
  });

  it('keeping a date\'s edited plan everywhere keeps the workout logged from it intact', async () => {
    const db = await freshDb();
    const push = await planId(db, 'Push');
    const date = '2026-11-19';
    await addWorkoutToDate(db, date, push, 'morning');
    const copyId = await makeDateCopy(db, date, 0);
    const sessionId = await startOrResume(db, { date, planId: copyId, time: 'morning' });
    const [slot] = await getEntries(db, copyId);
    await logSet(db, { sessionId, exerciseId: slot.exerciseId, planExerciseId: slot.id, setNumber: 1, parts: [W(135, 8)] });

    await updatePlanEverywhere(db, copyId);

    const session = await db.sessions.get(sessionId);
    expect(session?.planId).toBe(push);
    expect((await getEntries(db, push)).map((e) => e.id)).toContain(slot.id);
  });
});

