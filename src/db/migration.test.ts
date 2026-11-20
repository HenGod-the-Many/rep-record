import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { WorkoutDB } from './db';

describe('upgrading saved data from version 1', () => {
  it('turns one plan per day into a timed workout list, and gives schedules an offset', async () => {
    const name = `migrate-${Date.now()}`;
    // Write data in the version-1 shape, as the first build stored it.
    const v1 = new Dexie(name);
    v1.version(1).stores({
      exercises: 'id, name, muscleGroup, archived',
      plans: 'id, name',
      planExercises: 'id, planId, exerciseId, [planId+order]',
      splits: 'id',
      splitDays: 'id, splitId, [splitId+dayIndex]',
      schedules: 'id, splitId, startDate',
      dateOverrides: 'date',
      sessions: 'id, date, planId',
      setLogs: 'id, sessionId, exerciseId, [exerciseId+loggedAt]',
      dayNotes: 'date',
      settings: 'key',
    });
    await v1.open();
    await v1.table('splitDays').bulkAdd([
      { id: 'a', splitId: 's', dayIndex: 0, planId: 'push' },
      { id: 'b', splitId: 's', dayIndex: 1, planId: null },
    ]);
    await v1.table('dateOverrides').add({ date: '2026-11-16', planId: 'pull' });
    await v1.table('schedules').add({ id: 'x', splitId: 's', startDate: '2026-11-16', lengthDays: 7, createdAt: 1 });
    v1.close();

    const db = new WorkoutDB(name);
    await db.open();
    expect(await db.splitDays.get('a')).toEqual({ id: 'a', splitId: 's', dayIndex: 0, workouts: [{ planId: 'push', time: 'morning' }] });
    expect((await db.splitDays.get('b'))?.workouts).toEqual([]);
    expect(await db.dateOverrides.get('2026-11-16')).toEqual({ date: '2026-11-16', workouts: [{ planId: 'pull', time: 'morning' }] });
    expect((await db.schedules.get('x'))?.offset).toBe(0);
    db.close();
  });

  it('version 3 moves a set’s weight, reps and seconds into parts and closes old sessions', async () => {
    const name = `migrate3-${Date.now()}`;
    const v2 = new Dexie(name);
    v2.version(2).stores({
      exercises: 'id, name, muscleGroup, archived',
      plans: 'id, name',
      planExercises: 'id, planId, exerciseId, [planId+order]',
      splits: 'id',
      splitDays: 'id, splitId, [splitId+dayIndex]',
      schedules: 'id, splitId, startDate',
      dateOverrides: 'date',
      sessions: 'id, date, planId',
      setLogs: 'id, sessionId, exerciseId, [exerciseId+loggedAt]',
      dayNotes: 'date',
      settings: 'key',
    });
    await v2.open();
    await v2.table('sessions').add({ id: 's', date: '2026-11-10', planId: 'push', planName: 'Push', splitId: null, journalNote: '' });
    await v2.table('setLogs').add({
      id: 'l', sessionId: 's', exerciseId: 'bench', planExerciseId: null, setNumber: 1,
      weightLb: 185, reps: 8, seconds: null, note: '', loggedAt: 5,
    });
    v2.close();

    const db = new WorkoutDB(name);
    await db.open();
    expect(await db.setLogs.get('l')).toEqual({
      id: 'l', sessionId: 's', exerciseId: 'bench', planExerciseId: null, setNumber: 1,
      parts: [{ weightLb: 185, reps: 8, seconds: null }], difficulty: null, toFailure: false, note: '', loggedAt: 5,
    });
    const s = await db.sessions.get('s');
    expect(s).toMatchObject({ time: 'morning', swaps: {} });
    expect(s?.finishedAt).not.toBeNull();
    expect(await db.sessions.where('[date+planId]').equals(['2026-11-10', 'push']).count()).toBe(1);
    db.close();
  });
});
