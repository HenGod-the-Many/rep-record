import { describe, expect, it } from 'vitest';
import { chartPoints, epley, exerciseHistory, records } from './history';
import { swapForSession, logSet, startOrResume } from './logging';
import { createDateWorkout } from './reschedule';
import { addEntry, getEntries } from './plans';
import { setArchived } from './exercises';
import type { SetPart, WorkoutDB } from './db';
import { exerciseId, freshDb, planId } from '../test/helpers';

const w = (weightLb: number, reps: number): SetPart => ({ weightLb, reps, seconds: null });

async function log(db: WorkoutDB, sessionId: string, exId: string, setNumber: number, parts: SetPart[], extra: { difficulty?: number; toFailure?: boolean } = {}) {
  await logSet(db, { sessionId, exerciseId: exId, planExerciseId: null, setNumber, parts, ...extra });
}

describe('Epley estimated 1-rep max (R-06.3)', () => {
  it('uses weight × (1 + reps ÷ 30) for 1 to 12 reps, the weight itself for 1 rep', () => {
    expect(epley(225, 5)).toBe(262.5);
    expect(epley(135, 1)).toBe(135);
    expect(epley(100, 12)).toBe(140);
    expect(epley(100, 13)).toBeNull();
    expect(epley(0, 5)).toBeNull();
    expect(epley(null, 5)).toBeNull();
    expect(epley(100, 0)).toBeNull();
  });
});

describe('exercise history (R-06.1)', () => {
  it('lists every set of the exercise from any plan, a swap and a built-from-scratch workout, newest first', async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    const push = await startOrResume(db, { date: '2026-11-02', planId: await planId(db, 'Push'), time: 'morning' });
    await log(db, push, bench, 1, [w(135, 8)], { difficulty: 7 });
    await log(db, push, bench, 2, [w(135, 6)]);

    // Bench done in another plan, by a session-only swap for the first slot.
    const pullPlan = await planId(db, 'Pull');
    const pull = await startOrResume(db, { date: '2026-11-04', planId: pullPlan, time: 'morning' });
    const slot = (await getEntries(db, pullPlan))[0];
    await swapForSession(db, pull, slot, bench);
    await logSet(db, { sessionId: pull, exerciseId: bench, planExerciseId: slot.id, setNumber: 1, parts: [w(140, 5)] });

    // And in a workout built from scratch on a date.
    const scratch = await createDateWorkout(db, '2026-11-06', 'evening');
    await addEntry(db, scratch, bench);
    const s3 = await startOrResume(db, { date: '2026-11-06', planId: scratch, time: 'evening' });
    await log(db, s3, bench, 1, [w(145, 3)]);

    // Another exercise's sets are not included.
    await log(db, push, await exerciseId(db, 'Incline dumbbell press'), 1, [w(50, 10)]);

    const h = await exerciseHistory(db, bench);
    expect(h.map((x) => x.session.date)).toEqual(['2026-11-06', '2026-11-04', '2026-11-02']);
    expect(h[2].sets.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(h[2].sets[0].difficulty).toBe(7);
    expect(h.flatMap((x) => x.sets)).toHaveLength(4);
  });

  it('keeps an archived exercise’s history', async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    const s = await startOrResume(db, { date: '2026-11-02', planId: await planId(db, 'Push'), time: 'morning' });
    await log(db, s, bench, 1, [w(135, 8)]);
    await setArchived(db, bench, true);
    expect((await exerciseHistory(db, bench)).flatMap((x) => x.sets)).toHaveLength(1);
  });

  it('orders two workouts on one date by start time', async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    const push = await planId(db, 'Push');
    const a = await startOrResume(db, { date: '2026-11-02', planId: push, time: 'morning' });
    await db.sessions.update(a, { startedAt: 100 });
    const b = await startOrResume(db, { date: '2026-11-02', planId: push, time: 'evening', plannedTimes: ['morning', 'evening'] });
    await db.sessions.update(b, { startedAt: 200 });
    await log(db, a, bench, 1, [w(100, 5)]);
    await log(db, b, bench, 1, [w(110, 5)]);
    expect((await exerciseHistory(db, bench)).map((x) => x.session.id)).toEqual([b, a]);
  });
});

describe('records (R-06.2, R-05.7)', () => {
  it('heaviest weight and best estimated 1-rep max, each part counted at its own weight, dated when first reached', async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    const push = await planId(db, 'Push');
    const s1 = await startOrResume(db, { date: '2026-11-02', planId: push, time: 'morning' });
    // Weight change mid-set: 5 × 135 then 3 × 115. The 135 part counts at 135.
    await log(db, s1, bench, 1, [w(135, 5), w(115, 3)]);
    await log(db, s1, bench, 2, [w(100, 20)]); // too many reps for an estimate
    const s2 = await startOrResume(db, { date: '2026-11-09', planId: push, time: 'morning' });
    await log(db, s2, bench, 1, [w(135, 5)]); // ties the heaviest: keeps 2 Nov
    await log(db, s2, bench, 2, [w(125, 10)]); // 166.67 beats 157.5

    const r = records(await exerciseHistory(db, bench), 'weight');
    expect(r.heaviest).toMatchObject({ value: 135, date: '2026-11-02', reps: 5 });
    expect(r.bestE1rm?.value).toBeCloseTo(166.667, 2);
    expect(r.bestE1rm).toMatchObject({ date: '2026-11-09', weightLb: 125, reps: 10 });
  });

  it('a later part of a set can set the record', async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    const s = await startOrResume(db, { date: '2026-11-02', planId: await planId(db, 'Push'), time: 'morning' });
    // Went up mid-set: 5 × 100, then 2 × 130.
    await log(db, s, bench, 1, [w(100, 5), w(130, 2)]);
    const r = records(await exerciseHistory(db, bench), 'weight');
    expect(r.heaviest).toMatchObject({ value: 130, reps: 2 });
    expect(r.bestE1rm?.value).toBeCloseTo(138.667, 2); // 130 × (1 + 2/30) beats 100 × (1 + 5/30) = 116.67
  });

  it('bodyweight: most reps in one set and heaviest added weight; timed: longest hold', async () => {
    const db = await freshDb();
    const s = await startOrResume(db, { date: '2026-11-02', planId: await planId(db, 'Pull'), time: 'morning' });
    const pullUp = (await db.exercises.filter((e) => e.kind === 'bodyweight').first())!.id;
    await log(db, s, pullUp, 1, [{ weightLb: null, reps: 12, seconds: null }]);
    await log(db, s, pullUp, 2, [{ weightLb: 25, reps: 6, seconds: null }]);
    const rb = records(await exerciseHistory(db, pullUp), 'bodyweight');
    expect(rb.mostReps?.value).toBe(12);
    expect(rb.heaviest?.value).toBe(25);
    expect(rb.bestE1rm).toBeNull();

    const plank = (await db.exercises.filter((e) => e.kind === 'timed').first())!.id;
    await log(db, s, plank, 1, [{ weightLb: null, reps: null, seconds: 45 }]);
    await log(db, s, plank, 2, [{ weightLb: null, reps: null, seconds: 60 }]);
    expect(records(await exerciseHistory(db, plank), 'timed').longest?.value).toBe(60);
  });

  it('no sets: no records', () => {
    expect(records([], 'weight')).toEqual({ heaviest: null, bestE1rm: null, mostReps: null, longest: null, longestDistance: null });
  });
});

describe('chart points (R-06.4)', () => {
  it('one point per date, oldest first, with heaviest and best estimate that date', async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    const push = await planId(db, 'Push');
    const a = await startOrResume(db, { date: '2026-11-09', planId: push, time: 'morning' });
    const b = await startOrResume(db, { date: '2026-11-09', planId: push, time: 'evening', plannedTimes: ['morning', 'evening'] });
    const c = await startOrResume(db, { date: '2026-11-02', planId: push, time: 'morning' });
    await log(db, a, bench, 1, [w(135, 5)]);
    await log(db, b, bench, 1, [w(140, 1)]);
    await log(db, c, bench, 1, [w(130, 8)]);
    const pts = chartPoints(await exerciseHistory(db, bench), 'weight');
    expect(pts.map((p) => p.date)).toEqual(['2026-11-02', '2026-11-09']);
    expect(pts[1].values[0]).toBe(140);
    expect(pts[1].values[1]).toBe(157.5);
    expect(pts[0].values[1]).toBeCloseTo(164.667, 2);
  });
});

describe('speed', () => {
  it('two years of one exercise (300 workouts, 1,500 sets) loads and summarises in under a second', async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    const sessions = [];
    const logs = [];
    for (let i = 0; i < 300; i++) {
      const d = new Date(Date.UTC(2025, 0, 1) + i * 2.4 * 86400000).toISOString().slice(0, 10);
      sessions.push({ id: `s${i}`, date: d, time: 'morning', planId: null, planName: 'Push', splitId: null, journalNote: '', startedAt: i, finishedAt: i, swaps: {} });
      for (let n = 1; n <= 5; n++) {
        logs.push({ id: `l${i}-${n}`, sessionId: `s${i}`, exerciseId: bench, planExerciseId: null, setNumber: n, parts: [w(100 + i / 3, 5 + (n % 4))], difficulty: 7, toFailure: false, note: '', loggedAt: i * 10 + n });
      }
    }
    await db.sessions.bulkAdd(sessions as never[]);
    await db.setLogs.bulkAdd(logs as never[]);
    const t = performance.now();
    const h = await exerciseHistory(db, bench);
    records(h, 'weight');
    chartPoints(h, 'weight');
    expect(performance.now() - t).toBeLessThan(1000);
    expect(h).toHaveLength(300);
  });
});
