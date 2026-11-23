import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import {
  activityTotals,
  caloriesFor,
  estimateCalories,
  formatDistance,
  formatDuration,
  fromShownDistance,
  lastActivity,
  logActivity,
  paceOrSpeed,
} from './activities';
import { WorkoutDB } from './db';
import { createExercise, setArchived } from './exercises';
import { addEntry, getEntries, setActivityTarget, createPlan } from './plans';
import { startOrResume } from './logging';
import { saveEntry } from './body';
import { exerciseHistory, records } from './history';
import { liftingTotals, recentPrs } from './stats';
import { exportData, readBackup, restoreBackup } from './backup';
import { formatTargets } from '../format';
import { exerciseId, freshDb, planId } from '../test/helpers';

async function rideWorkout(db: WorkoutDB, date: string, minutes: number, mi: number | null, extra: { calories?: number; difficulty?: number; avgHr?: number } = {}) {
  const plan = await createPlan(db, `Cardio ${date}`);
  const bike = await exerciseId(db, 'Bike');
  const entry = await addEntry(db, plan, bike);
  const s = await startOrResume(db, { date, planId: plan, time: 'morning' });
  await logActivity(db, { sessionId: s, exerciseId: bike, planExerciseId: entry, seconds: minutes * 60, distanceMi: mi, ...extra });
  return { s, bike, entry, plan };
}

describe('activities are exercises (R-13.1)', () => {
  it('a new install has the seven built-in activities with distance and MET values', async () => {
    const db = await freshDb();
    const acts = (await db.exercises.toArray()).filter((e) => e.kind === 'activity');
    expect(acts.map((a) => [a.name, a.hasDistance, a.met]).sort()).toEqual(
      [['Bike', true, 7.5], ['Elliptical', false, 5], ['Hike', true, 6], ['Row', true, 7], ['Run', true, 9.8], ['Swim', true, 7], ['Walk', true, 3.5]].sort(),
    );
  });

  it('existing data gets them through the upgrade, but an exercise already called "Run" is left alone', async () => {
    const name = `v5-${Date.now()}`;
    const old = new WorkoutDB(name, 5);
    await old.open();
    await old.exercises.add({ id: 'mine', name: 'run', muscleGroup: 'Legs', equipment: '', kind: 'timed', archived: false });
    old.close();
    const db = new WorkoutDB(name);
    await db.open();
    const names = (await db.exercises.toArray()).map((e) => e.name.toLowerCase());
    expect(names.filter((n) => n === 'run')).toHaveLength(1);
    expect((await db.exercises.get('mine'))?.kind).toBe('timed');
    expect(names).toContain('bike');
    db.close();
    await Dexie.delete(name);
  });

  it('you can add your own activity with or without distance; MET defaults to 5 and is checked', async () => {
    const db = await freshDb();
    const id = await createExercise(db, { name: 'Rock climbing', muscleGroup: 'Cardio', equipment: '', kind: 'activity', hasDistance: false });
    expect(await db.exercises.get(id)).toMatchObject({ kind: 'activity', hasDistance: false, met: 5 });
    await expect(createExercise(db, { name: 'Odd', muscleGroup: '', equipment: '', kind: 'activity', met: 40 })).rejects.toThrow('MET');
    await setArchived(db, id, true);
    expect(await db.exercises.get(id)).toBeDefined();
  });
});

describe('in plans and splits (R-13.5)', () => {
  it('an activity goes in a plan with a target duration and distance', async () => {
    const db = await freshDb();
    const plan = await createPlan(db, 'Ride day');
    const entry = await addEntry(db, plan, await exerciseId(db, 'Bike'));
    expect((await getEntries(db, plan))[0]).toMatchObject({ targetSets: 1, repMin: 30, repMax: 30 });
    await setActivityTarget(db, entry, 45, 12);
    const e = (await getEntries(db, plan))[0];
    expect(formatTargets(e, 'activity')).toBe('45 min · 12 mi');
    expect(formatTargets(e, 'activity', 'kg')).toBe('45 min · 19.3 km');
    await expect(setActivityTarget(db, entry, 0, null)).rejects.toThrow('Minutes');
  });
});

describe('logging (R-13.2, R-13.3)', () => {
  it('duration and distance, with optional effort, heart rate and calories', async () => {
    const db = await freshDb();
    const { s, bike } = await rideWorkout(db, '2026-11-20', 45, 12, { difficulty: 6, avgHr: 142, calories: 520 });
    const [log] = await db.setLogs.where('sessionId').equals(s).toArray();
    expect(log).toMatchObject({ exerciseId: bike, parts: [{ weightLb: null, reps: null, seconds: 2700 }], distanceMi: 12, difficulty: 6, avgHr: 142, calories: 520 });
  });

  it('distance is left out for activities without one; logging again updates the same log', async () => {
    const db = await freshDb();
    const plan = await createPlan(db, 'Gym cardio');
    const ell = await exerciseId(db, 'Elliptical');
    const entry = await addEntry(db, plan, ell);
    const s = await startOrResume(db, { date: '2026-11-20', planId: plan, time: 'morning' });
    await logActivity(db, { sessionId: s, exerciseId: ell, planExerciseId: entry, seconds: 1200, distanceMi: 3 });
    await logActivity(db, { sessionId: s, exerciseId: ell, planExerciseId: entry, seconds: 1500, distanceMi: null });
    const logs = await db.setLogs.where('sessionId').equals(s).toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ distanceMi: null, parts: [{ seconds: 1500 }] });
  });

  it('refuses no duration, a bad distance or heart rate, and a non-activity', async () => {
    const db = await freshDb();
    const { s, bike, entry } = await rideWorkout(db, '2026-11-20', 30, 8);
    await expect(logActivity(db, { sessionId: s, exerciseId: bike, planExerciseId: entry, seconds: 0, distanceMi: 1 })).rejects.toThrow('duration');
    await expect(logActivity(db, { sessionId: s, exerciseId: bike, planExerciseId: entry, seconds: 60, distanceMi: -1 })).rejects.toThrow('distance');
    await expect(logActivity(db, { sessionId: s, exerciseId: bike, planExerciseId: entry, seconds: 60, distanceMi: 1, avgHr: 400 })).rejects.toThrow('heart rate');
    await expect(logActivity(db, { sessionId: s, exerciseId: await exerciseId(db, 'Bench press'), planExerciseId: null, seconds: 60, distanceMi: null })).rejects.toThrow('not an activity');
  });

  it('pre-fills from the last time that activity was logged, in any plan', async () => {
    const db = await freshDb();
    await rideWorkout(db, '2026-11-10', 40, 10);
    await rideWorkout(db, '2026-11-15', 50, 13);
    const { s, bike } = await rideWorkout(db, '2026-11-20', 30, 8);
    const last = await lastActivity(db, s, bike);
    expect(last).toMatchObject({ distanceMi: 13, parts: [{ seconds: 3000 }] });
  });
});

describe('calories (R-13.4)', () => {
  it('MET × kg × hours, rounded to 5: 30 min bike at 180 lb = 305', () => {
    expect(estimateCalories(7.5, 180, 1800)).toBe(305);
    expect(estimateCalories(9.8, 160, 3600)).toBe(710); // 9.8 × 72.57 × 1 = 711.2 → 710
  });

  it('typed calories win; otherwise an estimate from the bodyweight on or before that date; none without a bodyweight', async () => {
    const db = await freshDb();
    const bike = (await db.exercises.get((await exerciseId(db, 'Bike'))))!;
    const { s } = await rideWorkout(db, '2026-11-20', 30, 8);
    const [log] = await db.setLogs.where('sessionId').equals(s).toArray();
    expect(await caloriesFor(db, log, bike, '2026-11-20')).toEqual({ kcal: null, needsBodyweight: true });
    await saveEntry(db, 'bodyweight', '2026-11-18', 180);
    await saveEntry(db, 'bodyweight', '2026-11-25', 150); // a later weigh-in doesn't change this ride
    expect(await caloriesFor(db, log, bike, '2026-11-20')).toEqual({ kcal: 305, estimated: true });
    await db.setLogs.update(log.id, { calories: 410 });
    expect(await caloriesFor(db, (await db.setLogs.get(log.id))!, bike, '2026-11-20')).toEqual({ kcal: 410, estimated: false });
  });
});

describe('not sets, and history', () => {
  it('activities are left out of sets, volume and lifting PRs, but counted in the activities card', async () => {
    const db = await freshDb();
    await rideWorkout(db, '2026-11-17', 30, 8);
    await rideWorkout(db, '2026-11-18', 45, 12);
    expect(await liftingTotals(db, '2026-11-16', '2026-11-22')).toEqual({ sets: 0, volumeLb: 0 });
    expect(await recentPrs(db)).toEqual([]);
    expect(await activityTotals(db, '2026-11-16', '2026-11-22')).toEqual({ count: 2, seconds: 4500, distanceMi: 20 });
  });

  it("an activity's records are longest distance and longest duration", async () => {
    const db = await freshDb();
    const { bike } = await rideWorkout(db, '2026-11-10', 60, 15);
    await rideWorkout(db, '2026-11-12', 90, 14);
    const r = records(await exerciseHistory(db, bike), 'activity');
    expect(r.longestDistance).toMatchObject({ value: 15, date: '2026-11-10' });
    expect(r.longest).toMatchObject({ value: 5400, date: '2026-11-12' });
  });

  it('activity logs go into the backup and come back', async () => {
    const db = await freshDb();
    const { s } = await rideWorkout(db, '2026-11-20', 30, 8, { avgHr: 130 });
    const other = await freshDb({ seed: false });
    await restoreBackup(other, readBackup(JSON.stringify(await exportData(db)), other.verno).backup);
    const [log] = await other.setLogs.where('sessionId').equals(s).toArray();
    expect(log).toMatchObject({ distanceMi: 8, avgHr: 130 });
  });
});

describe('display', () => {
  it('distance in mi or km (stored in miles), duration, pace for runs and speed for rides', () => {
    expect(formatDistance(8, 'lb')).toBe('8 mi');
    expect(formatDistance(8, 'kg')).toBe('12.87 km');
    expect(fromShownDistance(10, 'kg')).toBeCloseTo(6.2137, 4);
    expect(formatDuration(2700)).toBe('45 min');
    expect(formatDuration(3900)).toBe('1 h 5 min');
    expect(paceOrSpeed('Run', 1800, 3, 'lb')).toBe('10:00 /mi');
    expect(paceOrSpeed('Bike', 1800, 8, 'lb')).toBe('16 mi/h');
  });

  it('a plan with a lifting slot is unaffected', async () => {
    const db = await freshDb();
    expect((await getEntries(db, await planId(db, 'Push')))[0].targetSets).toBeGreaterThan(1);
  });
});
