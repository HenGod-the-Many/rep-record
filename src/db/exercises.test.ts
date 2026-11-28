import { describe, expect, it } from 'vitest';
import { createExercise, listExercises, setArchived, updateExercise } from './exercises';
import * as exercisesModule from './exercises';
import { ValidationError } from './errors';
import { exerciseId, freshDb } from '../test/helpers';

const curl = { name: 'Test Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell', kind: 'weight' as const };

describe('exercise library (R-01.2)', () => {
  it('creates an exercise with name, muscle group, equipment and kind', async () => {
    const db = await freshDb();
    const id = await createExercise(db, { ...curl, name: '  Test   Curl ' });
    expect(await db.exercises.get(id)).toEqual({ id, ...curl, archived: false });
  });

  it('edits every field', async () => {
    const db = await freshDb();
    const id = await createExercise(db, curl);
    await updateExercise(db, id, { name: 'Timed Hang', muscleGroup: 'Forearms', equipment: 'Bar', kind: 'timed' });
    expect(await db.exercises.get(id)).toMatchObject({
      name: 'Timed Hang',
      muscleGroup: 'Forearms',
      equipment: 'Bar',
      kind: 'timed',
    });
  });

  it('refuses an empty name', async () => {
    const db = await freshDb();
    await expect(createExercise(db, { ...curl, name: '   ' })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('archiving (R-01.3)', () => {
  it('hides an archived exercise from the default list but keeps it and its logged sets', async () => {
    const db = await freshDb();
    const id = await exerciseId(db, 'Bench press');
    await db.setLogs.add({
      id: 's1', sessionId: 'x', exerciseId: id, planExerciseId: null, setNumber: 1,
      parts: [{ weightLb: 185, reps: 8, seconds: null }], difficulty: null, toFailure: false, note: '', loggedAt: 1,
    });
    await setArchived(db, id, true);
    expect((await listExercises(db)).map((e) => e.id)).not.toContain(id);
    expect((await listExercises(db, { includeArchived: true })).map((e) => e.id)).toContain(id);
    expect(await db.setLogs.where('exerciseId').equals(id).count()).toBe(1);
  });

  it('restores an archived exercise', async () => {
    const db = await freshDb();
    const id = await exerciseId(db, 'Bench press');
    await setArchived(db, id, true);
    await setArchived(db, id, false);
    expect((await listExercises(db)).map((e) => e.id)).toContain(id);
  });

  it('offers no way to delete an exercise', () => {
    const exported = Object.keys(exercisesModule);
    expect(exported.filter((k) => /delete|remove/i.test(k))).toEqual([]);
  });
});

describe('unique names (R-01.4)', () => {
  it('refuses a name that matches another ignoring case and spaces', async () => {
    const db = await freshDb();
    await expect(createExercise(db, { ...curl, name: ' bench  PRESS ' })).rejects.toThrow(/already exists/);
  });

  it('refuses a name that matches an archived exercise and says so', async () => {
    const db = await freshDb();
    await setArchived(db, await exerciseId(db, 'Plank'), true);
    await expect(createExercise(db, { ...curl, name: 'plank' })).rejects.toThrow(/\(archived\)/);
  });

  it('refuses renaming onto another exercise but allows keeping its own name', async () => {
    const db = await freshDb();
    const id = await exerciseId(db, 'Machine fly');
    await expect(updateExercise(db, id, { ...curl, name: 'Cable fly' })).rejects.toThrow(/already exists/);
    await expect(updateExercise(db, id, { ...curl, name: 'machine FLY' })).resolves.toBeUndefined();
  });
});

describe('changing how an exercise is measured asks first when it has history (W-25, R-17.6)', () => {
  it('counts the sets logged for the exercise, from any workout', async () => {
    const db = await freshDb();
    const { loggedSetCount } = exercisesModule;
    const { logSet, startOrResume } = await import('./logging');
    const { planId } = await import('../test/helpers');
    const bench = await exerciseId(db, 'Bench press');
    expect(await loggedSetCount(db, bench)).toBe(0);
    const s = await startOrResume(db, { date: '2026-11-27', planId: await planId(db, 'Push'), time: 'morning' });
    for (const n of [1, 2]) await logSet(db, { sessionId: s, exerciseId: bench, planExerciseId: null, setNumber: n, parts: [{ weightLb: 135, reps: 5, seconds: null }] });
    expect(await loggedSetCount(db, bench)).toBe(2);
    expect(await loggedSetCount(db, await exerciseId(db, 'Squat'))).toBe(0);
  });
});
