import { describe, expect, it } from 'vitest';
import { minutesExercised, planAdherence, recentExercises, weekPrCount, weekPrs, weekStreak, weeklyVolume, weekWorkouts } from './home';
import { finishSession, logSet, startOrResume } from './logging';
import { logActivity } from './activities';
import { createExercise, setArchived } from './exercises';
import { addWorkoutToDate, scheduleSplit, setWeekStart } from './schedule';
import type { SetPart, WorkoutDB } from './db';
import { exerciseId, freshDb, planId } from '../test/helpers';

const w = (weightLb: number, reps: number): SetPart => ({ weightLb, reps, seconds: null });
const MIN = 60_000;

/** A workout on a date with given sets; finished after `minutes` unless finish is false. */
async function workout(db: WorkoutDB, date: string, sets: [string, SetPart[]][], opts: { minutes?: number; finish?: boolean; time?: string } = {}) {
  const s = await startOrResume(db, { date, planId: await planId(db, 'Push'), time: opts.time ?? 'morning', plannedTimes: ['morning', 'evening'] });
  let n = 0;
  for (const [name, parts] of sets) await logSet(db, { sessionId: s, exerciseId: await exerciseId(db, name), planExerciseId: null, setNumber: ++n, parts });
  if (opts.finish !== false) {
    await finishSession(db, s);
    const start = Date.parse(`${date}T08:00:00`);
    await db.sessions.update(s, { startedAt: start, finishedAt: start + (opts.minutes ?? 45) * MIN });
  }
  return s;
}

async function activity(db: WorkoutDB, date: string, minutes: number, finish = false, time = 'evening') {
  let ex = await db.exercises.filter((e) => e.name === 'Rock climbing').first();
  const exId = ex ? ex.id : await createExercise(db, { name: 'Rock climbing', muscleGroup: 'Cardio', equipment: '', kind: 'activity', hasDistance: false });
  const s = await startOrResume(db, { date, planId: await planId(db, 'Push'), time, plannedTimes: ['morning', 'evening'] });
  await logActivity(db, { sessionId: s, exerciseId: exId, planExerciseId: null, seconds: minutes * 60, distanceMi: null });
  if (finish) {
    await finishSession(db, s);
    const start = Date.parse(`${date}T18:00:00`);
    await db.sessions.update(s, { startedAt: start, finishedAt: start + 5 * MIN });
  }
  ex = undefined;
  return s;
}

// Week of Thursday 2026-11-19 with the default Monday start: 16th to 22nd.
const TODAY = '2026-11-19';

describe('Home: new PRs this week (R-16.4)', () => {
  it('counts each exercise that set a record this week once; first-ever sessions are not PRs', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-09', [['Bench press', [w(135, 5)]], ['Shoulder press', [w(85, 5)]]]); // starting marks
    await workout(db, '2026-11-17', [['Bench press', [w(145, 5)]], ['Shoulder press', [w(85, 5)]]]); // bench: heavier and e1RM
    await workout(db, '2026-11-18', [['Incline dumbbell press', [w(50, 8)]]]); // first ever: not a PR
    expect(await weekPrCount(db, TODAY)).toBe(1);
  });

  it('a record from last week does not count this week', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-02', [['Bench press', [w(135, 5)]]]);
    await workout(db, '2026-11-10', [['Bench press', [w(155, 5)]]]);
    await workout(db, '2026-11-17', [['Bench press', [w(135, 5)]]]);
    expect(await weekPrCount(db, TODAY)).toBe(0);
  });
});

/**
 * A workout timed by its ticks (W-25): started at 08:00 on `date`, one set ticked
 * at each of `ticks` minutes after Start, finished at `finish` minutes (or never).
 */
async function timed(db: WorkoutDB, date: string, ticks: number[], opts: { finish?: number | null; run?: [number, number] } = {}) {
  const s = await startOrResume(db, { date, planId: await planId(db, 'Push'), time: 'morning', plannedTimes: ['morning', 'evening'] });
  const start = Date.parse(`${date}T08:00:00`);
  const bench = await exerciseId(db, 'Bench press');
  let n = 0;
  for (const m of ticks) {
    const id = await logSet(db, { sessionId: s, exerciseId: bench, planExerciseId: null, setNumber: ++n, parts: [w(135, 5)] });
    await db.setLogs.update(id, { loggedAt: start + m * MIN });
  }
  if (opts.run) {
    let ex = await db.exercises.filter((e) => e.name === 'Rock climbing').first();
    const exId = ex ? ex.id : await createExercise(db, { name: 'Rock climbing', muscleGroup: 'Cardio', equipment: '', kind: 'activity', hasDistance: false });
    ex = undefined;
    const [atMin, minutes] = opts.run;
    await logActivity(db, { sessionId: s, exerciseId: exId, planExerciseId: null, seconds: minutes * 60, distanceMi: null });
    const log = (await db.setLogs.where('sessionId').equals(s).toArray()).find((l) => l.exerciseId === exId)!;
    await db.setLogs.update(log.id, { loggedAt: start + atMin * MIN });
  }
  await db.sessions.update(s, { startedAt: start, finishedAt: opts.finish == null ? null : start + opts.finish * MIN });
  return s;
}

// Replaced in W-25 (R-17.5): minutes used to be Start to Finish; they are now the timed duration.
describe('Home: minutes exercised this week use the timer (R-17.5)', () => {
  it('each workout counts Start to its last tick, not to Finish; last week does not count', async () => {
    const db = await freshDb();
    await timed(db, '2026-11-16', [5, 20, 35, 50], { finish: 80 }); // 50, not 80
    await timed(db, '2026-11-18', [4, 10], { finish: null }); // never finished: still 10
    await timed(db, '2026-11-12', [5, 60], { finish: 60 }); // last week
    expect(await minutesExercised(db, TODAY)).toBe(60);
  });

  it('a forgotten tick caught up at Finish counts at most 15 minutes', async () => {
    const db = await freshDb();
    await timed(db, '2026-11-16', [4, 8, 68], { finish: 68 }); // 4 + 4 + 15
    expect(await minutesExercised(db, TODAY)).toBe(23);
  });

  it('a workout with no ticks counts Start to Finish; one left open with none counts 0', async () => {
    const db = await freshDb();
    await timed(db, '2026-11-16', [], { finish: 45 });
    await timed(db, '2026-11-17', [], { finish: null });
    expect(await minutesExercised(db, TODAY)).toBe(45);
  });

  it('an activity inside a workout is inside its time; an activity-only workout never finished counts the activity', async () => {
    const db = await freshDb();
    await timed(db, '2026-11-16', [2], { finish: 40, run: [32, 30] }); // Start to the run's tick: 32
    await timed(db, '2026-11-18', [], { finish: null, run: [120, 30] }); // activity only, open: 30
    expect(await minutesExercised(db, TODAY)).toBe(62);
  });
});

describe('Home: week streak (R-16.4)', () => {
  it('weeks in a row with a finished workout or an activity, ending this week', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-17', [['Bench press', [w(135, 5)]]]); // this week
    await activity(db, '2026-11-11', 20); // last week: an activity counts
    await workout(db, '2026-11-03', [['Bench press', [w(135, 5)]]]); // the week before
    await workout(db, '2026-10-20', [['Bench press', [w(135, 5)]]]); // gap week of Oct 26: streak stops
    expect(await weekStreak(db, TODAY)).toBe(3);
  });

  it('a streak ending last week still counts (this week is not over); an open workout alone does not count', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-18', [['Bench press', [w(135, 5)]]], { finish: false }); // this week, not finished
    await workout(db, '2026-11-10', [['Bench press', [w(135, 5)]]]);
    await workout(db, '2026-11-04', [['Bench press', [w(135, 5)]]]);
    expect(await weekStreak(db, TODAY)).toBe(2);
  });

  it('is 0 when neither this week nor last week has anything', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-02', [['Bench press', [w(135, 5)]]]);
    expect(await weekStreak(db, TODAY)).toBe(0);
  });

  it('follows the first-day-of-week setting', async () => {
    const db = await freshDb();
    await setWeekStart(db, 0); // Sunday start: this week is 15th to 21st
    await workout(db, '2026-11-15', [['Bench press', [w(135, 5)]]]); // Sunday: this week
    await workout(db, '2026-11-14', [['Bench press', [w(135, 5)]]]); // Saturday: last week
    expect(await weekStreak(db, TODAY)).toBe(2);
  });
});

describe('Home: weekly volume (R-16.4)', () => {
  it('this week against last week, in percent', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-17', [['Bench press', [w(100, 10), w(100, 10)]]]); // 2000
    await workout(db, '2026-11-10', [['Bench press', [w(100, 8), w(100, 8)]]]); // 1600
    expect(await weeklyVolume(db, TODAY)).toEqual({ volumeLb: 2000, lastWeekLb: 1600, changePct: 25 });
  });

  it('no change figure when last week had no volume', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-17', [['Bench press', [w(100, 10)]]]);
    expect(await weeklyVolume(db, TODAY)).toEqual({ volumeLb: 1000, lastWeekLb: 0, changePct: null });
  });
});

describe('Home: plan adherence (R-16.4)', () => {
  it('finished workouts this week out of workouts scheduled this week, including one-date changes', async () => {
    const db = await freshDb();
    const push = await planId(db, 'Push');
    const pull = await planId(db, 'Pull');
    await addWorkoutToDate(db, '2026-11-16', push);
    await addWorkoutToDate(db, '2026-11-18', pull);
    await addWorkoutToDate(db, '2026-11-20', push);
    await addWorkoutToDate(db, '2026-11-23', push); // next week: not counted
    await workout(db, '2026-11-16', [['Bench press', [w(135, 5)]]]);
    await workout(db, '2026-11-18', [['Bench press', [w(135, 5)]]], { finish: false });
    expect(await planAdherence(db, TODAY)).toEqual({ done: 1, scheduled: 3 });
  });

  it('counts workouts scheduled by a program', async () => {
    const db = await freshDb();
    const split = (await db.splits.toArray())[0]; // seeded 5-day program: 5 workouts and 2 rest days a week
    await scheduleSplit(db, split.id, '2026-11-16', 28);
    await workout(db, '2026-11-16', [['Bench press', [w(135, 5)]]]);
    expect(await planAdherence(db, TODAY)).toEqual({ done: 1, scheduled: 5 });
  });

  it('nothing scheduled gives null', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-16', [['Bench press', [w(135, 5)]]]);
    expect(await planAdherence(db, TODAY)).toBeNull();
  });
});

describe('Progress: this week in detail (R-16.4, R-16.6)', () => {
  // Replaced in W-25 (R-17.5): the list uses the timed duration, like minutes exercised.
  it("lists this week's timed workouts, newest first, with their timed minutes", async () => {
    const db = await freshDb();
    const a = await timed(db, '2026-11-16', [5, 20, 35, 50], { finish: 70 });
    const b = await timed(db, '2026-11-18', [3, 15, 30], { finish: 31 });
    await timed(db, '2026-11-17', [], { finish: null }); // open, nothing ticked: not listed
    await timed(db, '2026-11-12', [5, 40], { finish: 40 }); // last week
    const list = await weekWorkouts(db, TODAY);
    expect(list.map((x) => [x.sessionId, x.date, x.minutes])).toEqual([[b, '2026-11-18', 30], [a, '2026-11-16', 50]]);
    expect(list[0].name).toBe('Push');
  });

  it('also lists unfinished workouts that have a timed duration, so the list adds up to minutes exercised', async () => {
    const db = await freshDb();
    await timed(db, '2026-11-16', [5, 20, 35, 50], { finish: 70 });
    const open = await timed(db, '2026-11-17', [4, 12, 20], { finish: null });
    const run = await timed(db, '2026-11-18', [], { finish: null, run: [60, 30] });
    const list = await weekWorkouts(db, TODAY);
    expect(list.map((x) => [x.sessionId, x.minutes, x.finished])).toEqual([[run, 30, false], [open, 20, false], [expect.any(String), 50, true]]);
    expect(list.reduce((n, x) => n + x.minutes, 0)).toBe(await minutesExercised(db, TODAY));
  });

  it("lists this week's new records, one line per exercise with its best record", async () => {
    const db = await freshDb();
    await workout(db, '2026-11-09', [['Bench press', [w(135, 5)]], ['Shoulder press', [w(85, 5)]]]);
    await workout(db, '2026-11-17', [['Bench press', [w(145, 5)]]]);
    await workout(db, '2026-11-18', [['Shoulder press', [w(85, 8)]]]); // same weight, more reps: e1RM only
    const list = await weekPrs(db, TODAY);
    expect(list.map((p) => [p.name, p.record])).toEqual([['Shoulder press', 'e1rm'], ['Bench press', 'heaviest']]);
    expect(await weekPrCount(db, TODAY)).toBe(list.length);
  });
});

describe('Progress: exercises most recently done (R-16.6)', () => {
  it('lists exercises with logged sets, most recent first, each once, archived ones included', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-02', [['Bench press', [w(135, 5)]], ['Shoulder press', [w(85, 5)]]]);
    await workout(db, '2026-11-10', [['Bench press', [w(135, 5)]]]);
    await workout(db, '2026-11-12', [['Leg press', [w(300, 10)]]]);
    await setArchived(db, await exerciseId(db, 'Shoulder press'), true);
    const list = await recentExercises(db, 10);
    expect(list.map((x) => [x.name, x.lastDate])).toEqual([['Leg press', '2026-11-12'], ['Bench press', '2026-11-10'], ['Shoulder press', '2026-11-02']]);
    expect((await recentExercises(db, 2)).length).toBe(2);
  });
});
