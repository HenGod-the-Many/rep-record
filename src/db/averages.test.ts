import { describe, expect, it } from 'vitest';
import type { SetPart, WorkoutDB } from './db';
import { exerciseAverageMs, workoutAverages } from './averages';
import { logSet, startOrResume } from './logging';
import { exerciseId, freshDb, planId } from '../test/helpers';

/** Averages of the last 5 times (W-25 slice 3, R-17.4). */

const MIN = 60_000;
const w = (reps: number): SetPart[] => [{ weightLb: 100, reps, seconds: null }];
const TODAY = '2026-11-27';

/** A Push workout on `date` started at 08:00; each [exercise, minute] is a set ticked that many minutes after Start. */
async function workout(db: WorkoutDB, date: string, sets: [string, number][], opts: { finished?: boolean; plan?: string } = {}) {
  const s = await startOrResume(db, { date, planId: opts.plan ?? (await planId(db, 'Push')), time: 'morning' });
  const start = Date.parse(`${date}T08:00:00`);
  const n = new Map<string, number>();
  for (const [name, m] of sets) {
    const ex = await exerciseId(db, name);
    n.set(ex, (n.get(ex) ?? 0) + 1);
    const id = await logSet(db, { sessionId: s, exerciseId: ex, planExerciseId: null, setNumber: n.get(ex)!, parts: w(10) });
    await db.setLogs.update(id, { loggedAt: start + m * MIN });
  }
  await db.sessions.update(s, { startedAt: start, finishedAt: opts.finished === false ? null : start + 90 * MIN });
  return s;
}

describe("An exercise's average time (R-17.4)", () => {
  it('is the mean of its time in the last 5 workouts it was done in, whatever the workout', async () => {
    const db = await freshDb();
    // Bench: first set 30 s (10 reps × 3 s), then n minutes for the second set.
    const days = ['2026-11-10', '2026-11-12', '2026-11-14', '2026-11-16', '2026-11-18', '2026-11-20'];
    const gaps = [10, 1, 2, 3, 4, 5]; // the oldest (10) is left out
    for (let i = 0; i < days.length; i++) await workout(db, days[i], [['Bench press', 1], ['Bench press', 1 + gaps[i]]]);
    // Mean of 0.5 + (1..5) minutes = 3.5 minutes (each set at most 5 minutes).
    expect(await exerciseAverageMs(db, await exerciseId(db, 'Bench press'), TODAY)).toBe(3.5 * MIN);
  });

  it('leaves out a workout still in progress today', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-20', [['Bench press', 1], ['Bench press', 3]]); // 2.5 min
    await workout(db, TODAY, [['Bench press', 1]], { finished: false }); // in progress: 0.5 min so far
    expect(await exerciseAverageMs(db, await exerciseId(db, 'Bench press'), TODAY)).toBe(2.5 * MIN);
  });

  it('has none when the exercise was never done', async () => {
    const db = await freshDb();
    expect(await exerciseAverageMs(db, await exerciseId(db, 'Bench press'), TODAY)).toBeNull();
  });
});

describe("A workout's average time, \"about N min\" (R-17.4)", () => {
  it('is the mean timed duration of its last 5 sessions', async () => {
    const db = await freshDb();
    const push = await planId(db, 'Push');
    const lengths = [60, 40, 41, 42, 43, 44]; // the oldest (60) is left out
    for (let i = 0; i < lengths.length; i++) {
      const ticks: [string, number][] = [];
      for (let m = 5; m <= lengths[i]; m += 5) ticks.push(['Bench press', m]);
      if (lengths[i] % 5) ticks.push(['Bench press', lengths[i]]);
      await workout(db, `2026-11-${String(10 + i).padStart(2, '0')}`, ticks);
    }
    expect((await workoutAverages(db, TODAY)).get(push)).toBe(42 * MIN);
  });

  it("counts a one-date copy's workouts toward the workout it was copied from", async () => {
    const db = await freshDb();
    const push = await planId(db, 'Push');
    const copy = 'one-date-copy';
    await db.plans.add({ id: copy, name: 'Push', notes: '', hidden: true, sourcePlanId: push });
    await workout(db, '2026-11-20', [['Bench press', 5], ['Bench press', 10]], { plan: copy });
    const avg = await workoutAverages(db, TODAY);
    expect(avg.get(push)).toBe(10 * MIN);
  });

  it('has no entry for a workout never done', async () => {
    const db = await freshDb();
    expect((await workoutAverages(db, TODAY)).has(await planId(db, 'Push'))).toBe(false);
  });
});
