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

describe('Home: minutes exercised this week (R-16.4)', () => {
  it('finish minus start for each finished workout, capped at 4 hours; open workouts without activities count 0', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-16', [['Bench press', [w(135, 5)]]], { minutes: 50 });
    await workout(db, '2026-11-17', [['Bench press', [w(135, 5)]]], { minutes: 400 }); // left running: capped at 240
    await workout(db, '2026-11-18', [['Bench press', [w(135, 5)]]], { finish: false });
    await workout(db, '2026-11-12', [['Bench press', [w(135, 5)]]], { minutes: 60 }); // last week
    expect(await minutesExercised(db, TODAY)).toBe(290);
  });

  it('adds logged activities, without counting an activity twice when it sits inside a timed workout', async () => {
    const db = await freshDb();
    await activity(db, '2026-11-16', 30); // activity-only, never finished: its 30 minutes
    await activity(db, '2026-11-18', 40, true); // finished after 5 minutes, but the activity says 40: 40
    expect(await minutesExercised(db, TODAY)).toBe(70);
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
  it("lists this week's finished workouts, newest first, with their minutes", async () => {
    const db = await freshDb();
    const a = await workout(db, '2026-11-16', [['Bench press', [w(135, 5)]]], { minutes: 50 });
    const b = await workout(db, '2026-11-18', [['Bench press', [w(135, 5)]]], { minutes: 300 });
    await workout(db, '2026-11-17', [['Bench press', [w(135, 5)]]], { finish: false }); // open: not listed
    await workout(db, '2026-11-12', [['Bench press', [w(135, 5)]]]); // last week
    const list = await weekWorkouts(db, TODAY);
    expect(list.map((x) => [x.sessionId, x.date, x.minutes])).toEqual([[b, '2026-11-18', 240], [a, '2026-11-16', 50]]);
    expect(list[0].name).toBe('Push');
  });

  it('also lists an unfinished workout with activity time, so the list adds up to minutes exercised', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-16', [['Bench press', [w(135, 5)]]], { minutes: 50 });
    const run = await activity(db, '2026-11-17', 30); // never finished
    const list = await weekWorkouts(db, TODAY);
    expect(list.map((x) => [x.sessionId, x.minutes, x.finished])).toEqual([[run, 30, false], [expect.any(String), 50, true]]);
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
