import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, monthGrid, timeSortKey, todayLocal, weekDates, weekday } from './dates';
import {
  addWorkoutToDate,
  clearDate,
  createSplit,
  deleteSchedule,
  deleteSplit,
  duplicateSplit,
  getSplitDays,
  getWeekStart,
  replaceWorkout,
  resetDate,
  resolveDate,
  resolveRange,
  scheduleSplit,
  setCycleLength,
  setSplitDayWorkouts,
  setWeekStart,
} from './schedule';
import { freshDb, planId } from '../test/helpers';
import type { WorkoutDB } from './db';

const MON = '2026-11-16'; // a Monday

async function defaultSplit(db: WorkoutDB) {
  const s = await db.splits.toArray();
  return s[0].id;
}

/** Plan names (or "Rest" / "—") for each date, joined with " + " for several workouts. */
async function names(db: WorkoutDB, from: string, days: number) {
  const plans = new Map((await db.plans.toArray()).map((p) => [p.id, p.name]));
  return (await resolveRange(db, from, addDays(from, days))).map((d) =>
    !d.scheduled && !d.overridden ? '—' : d.workouts.length === 0 ? 'Rest' : d.workouts.map((w) => plans.get(w.planId)).join(' + '),
  );
}

const WEEK = ['Push', 'Pull', 'Legs & Abs', 'Rest', 'Chest, Back, Arms', 'Shoulders & Legs', 'Rest'];

describe('local calendar dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2026-12-28', '2027-01-03')).toBe(6);
  });

  it('is not moved by the daylight-saving change', () => {
    // US clocks change on 2026-03-08; every day is still exactly one step.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(daysBetween('2026-03-01', '2026-03-15')).toBe(14);
    expect(weekday('2026-03-08')).toBe(0);
  });

  it('knows the weekday and builds a week from the chosen first day', () => {
    expect(weekday(MON)).toBe(1);
    expect(weekDates('2026-11-18', 1)[0]).toBe(MON);
    expect(weekDates('2026-11-18', 1)[6]).toBe('2026-11-22');
    expect(weekDates('2026-11-18', 0)[0]).toBe('2026-11-15');
  });

  it('reads today from the local clock, not UTC', () => {
    expect(todayLocal(new Date(2026, 10, 18, 23, 30))).toBe('2026-11-18');
    expect(todayLocal(new Date(2026, 10, 18, 0, 5))).toBe('2026-11-18');
  });

  it('lays out a month grid starting on the week start', () => {
    const grid = monthGrid('2026-11', 1);
    expect(grid[0]).toBe('2026-10-26'); // Monday before Nov 1 (a Sunday)
    expect(grid.length % 7).toBe(0);
    expect(grid).toContain('2026-11-30');
  });

  it('orders times through the day', () => {
    const order = ['night', '07:30', 'evening', 'morning', 'noon'].sort((a, b) => timeSortKey(a) - timeSortKey(b));
    expect(order).toEqual(['07:30', 'morning', 'noon', 'evening', 'night']);
  });
});

describe('splits', () => {
  it('creates a split with one empty (rest) day per cycle day, entered in weeks', async () => {
    const db = await freshDb();
    const id = await createSplit(db, 'Two-week block', 14);
    const days = await getSplitDays(db, id);
    expect(days).toHaveLength(14);
    expect(days.every((d) => d.workouts.length === 0)).toBe(true);
  });

  it('a day can hold several workouts, each with a time', async () => {
    const db = await freshDb();
    const id = await defaultSplit(db);
    const day0 = (await getSplitDays(db, id))[0];
    const pull = await planId(db, 'Pull');
    await setSplitDayWorkouts(db, day0.id, [
      { planId: day0.workouts[0].planId, time: 'evening' },
      { planId: pull, time: '06:15' },
    ]);
    const today = await resolveDate(db, MON);
    expect(today.workouts).toHaveLength(0); // not scheduled yet
    await scheduleSplit(db, id, MON, 7);
    const plans = new Map((await db.plans.toArray()).map((p) => [p.id, p.name]));
    expect((await resolveDate(db, MON)).workouts.map((w) => plans.get(w.planId))).toEqual(['Pull', 'Push']);
  });

  it('changing the cycle length adds rest days or drops trailing days', async () => {
    const db = await freshDb();
    const id = await defaultSplit(db);
    await setCycleLength(db, id, 9);
    expect(await getSplitDays(db, id)).toHaveLength(9);
    expect((await getSplitDays(db, id))[8].workouts).toEqual([]);
    await setCycleLength(db, id, 3);
    expect(await getSplitDays(db, id)).toHaveLength(3);
    expect((await db.splits.get(id))?.cycleDays).toBe(3);
  });

  it('duplicating a split copies its days independently', async () => {
    const db = await freshDb();
    const id = await defaultSplit(db);
    const copy = await duplicateSplit(db, id);
    const copyDays = await getSplitDays(db, copy);
    await setSplitDayWorkouts(db, copyDays[0].id, []);
    expect((await getSplitDays(db, id))[0].workouts).toHaveLength(1);
  });

  it('deleting a split that is on the calendar removes its days and its schedules (Taylor, 2026-11-18)', async () => {
    const db = await freshDb();
    const id = await defaultSplit(db);
    const other = await createSplit(db, 'Other', 7);
    await scheduleSplit(db, id, MON, 7);
    const keep = await scheduleSplit(db, other, addDays(MON, 7), 7);
    await deleteSplit(db, id);
    expect(await db.splits.get(id)).toBeUndefined();
    expect(await db.splitDays.where('splitId').equals(id).count()).toBe(0);
    expect(await db.schedules.where('splitId').equals(id).count()).toBe(0);
    expect(await db.schedules.get(keep)).toBeDefined();
    expect((await resolveDate(db, MON)).scheduled).toBe(false);
  });

  it('a schedule can be removed on its own', async () => {
    const db = await freshDb();
    const sched = await scheduleSplit(db, await defaultSplit(db), MON, 7);
    await deleteSchedule(db, sched);
    expect((await resolveDate(db, MON)).scheduled).toBe(false);
  });
});

describe('schedules', () => {
  it('fills every date in range from the cycle, across a cycle and month boundary', async () => {
    const db = await freshDb();
    await scheduleSplit(db, await defaultSplit(db), MON, 21);
    expect(await names(db, MON, 21)).toEqual([...WEEK, ...WEEK, ...WEEK]);
  });

  it('start date is included, the day after the last day shows nothing', async () => {
    const db = await freshDb();
    await scheduleSplit(db, await defaultSplit(db), MON, 7);
    expect(await names(db, addDays(MON, -1), 9)).toEqual(['—', ...WEEK, '—']);
  });

  it('the cycle continues across a year end', async () => {
    const db = await freshDb();
    await scheduleSplit(db, await defaultSplit(db), '2026-12-28', 14);
    expect(await names(db, '2027-01-04', 7)).toEqual(WEEK);
  });

  it('where schedules overlap, the newest decides', async () => {
    const db = await freshDb();
    const id = await defaultSplit(db);
    await scheduleSplit(db, id, MON, 14);
    const other = await createSplit(db, 'All Pull', 1);
    await setSplitDayWorkouts(db, (await getSplitDays(db, other))[0].id, [{ planId: await planId(db, 'Pull'), time: 'noon' }]);
    await scheduleSplit(db, other, addDays(MON, 7), 3);
    expect(await names(db, addDays(MON, 6), 6)).toEqual(['Rest', 'Pull', 'Pull', 'Pull', 'Rest', 'Chest, Back, Arms']);
  });

  it('a missed day does not shift later days', async () => {
    const db = await freshDb();
    await scheduleSplit(db, await defaultSplit(db), MON, 7);
    // Nothing logged on Monday; Tuesday is still Pull.
    expect(await names(db, addDays(MON, 1), 1)).toEqual(['Pull']);
  });

  it('a daylight-saving week keeps one workout per date', async () => {
    const db = await freshDb();
    await scheduleSplit(db, await defaultSplit(db), '2026-03-02', 14);
    expect(await names(db, '2026-03-02', 14)).toEqual([...WEEK, ...WEEK]);
  });
});

describe('single-date changes', () => {
  it('an override beats the schedule and can be reset', async () => {
    const db = await freshDb();
    await scheduleSplit(db, await defaultSplit(db), MON, 7);
    await replaceWorkout(db, MON, 0, await planId(db, 'Pull'));
    expect(await names(db, MON, 2)).toEqual(['Pull', 'Pull']);
    expect((await resolveDate(db, MON)).overridden).toBe(true);
    await resetDate(db, MON);
    expect(await names(db, MON, 1)).toEqual(['Push']);
    // The split itself never changed.
    expect((await getSplitDays(db, await defaultSplit(db)))[0].workouts).toHaveLength(1);
  });

  it('clear makes the date a rest day; add puts a second workout on it', async () => {
    const db = await freshDb();
    await scheduleSplit(db, await defaultSplit(db), MON, 7);
    await clearDate(db, MON);
    expect(await names(db, MON, 1)).toEqual(['Rest']);
    await addWorkoutToDate(db, addDays(MON, 1), await planId(db, 'Legs & Abs'), 'night');
    expect(await names(db, addDays(MON, 1), 1)).toEqual(['Pull + Legs & Abs']);
  });

  it('week start defaults to Monday and can be changed', async () => {
    const db = await freshDb();
    expect(await getWeekStart(db)).toBe(1);
    await setWeekStart(db, 0);
    expect(await getWeekStart(db)).toBe(0);
  });
});

describe('date checks', () => {
  it('refuses a date that does not exist', async () => {
    const db = await freshDb();
    await expect(clearDate(db, '2026-02-31')).rejects.toThrow(/date/);
    await clearDate(db, '2028-02-29'); // leap day is real
    expect((await resolveDate(db, '2028-02-29')).overridden).toBe(true);
  });
});
