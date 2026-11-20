import { describe, expect, it } from 'vitest';
import { datesWithNotes, getDayNote, nextRating, saveDayNote, setSessionNote, tapDayRating } from './journal';
import { exerciseHistory } from './history';
import { logSet, startOrResume } from './logging';
import { exerciseId, freshDb, planId } from '../test/helpers';

describe('workout note (R-07.1)', () => {
  it('is saved on the workout and read back', async () => {
    const db = await freshDb();
    const s = await startOrResume(db, { date: '2026-11-20', planId: await planId(db, 'Push'), time: 'morning' });
    await setSessionNote(db, s, 'Left shoulder tight');
    expect((await db.sessions.get(s))?.journalNote).toBe('Left shoulder tight');
    await setSessionNote(db, s, '');
    expect((await db.sessions.get(s))?.journalNote).toBe('');
  });

  it('refuses a workout that no longer exists', async () => {
    const db = await freshDb();
    await expect(setSessionNote(db, 'gone', 'x')).rejects.toThrow('no longer exists');
  });
});

describe('day note (R-07.2)', () => {
  it('energy, sleep, soreness 1–5 and text, all optional, saved piece by piece', async () => {
    const db = await freshDb();
    expect(await getDayNote(db, '2026-11-20')).toEqual({ date: '2026-11-20', energy: null, sleep: null, soreness: null, note: '' });
    await saveDayNote(db, '2026-11-20', { energy: 4 });
    await saveDayNote(db, '2026-11-20', { sleep: 3 });
    await saveDayNote(db, '2026-11-20', { note: 'Slept badly' });
    expect(await getDayNote(db, '2026-11-20')).toEqual({ date: '2026-11-20', energy: 4, sleep: 3, soreness: null, note: 'Slept badly' });
  });

  it('refuses ratings outside 1–5', async () => {
    const db = await freshDb();
    await expect(saveDayNote(db, '2026-11-20', { energy: 6 })).rejects.toThrow('1 to 5');
    await expect(saveDayNote(db, '2026-11-20', { sleep: 0 })).rejects.toThrow('1 to 5');
    await expect(saveDayNote(db, '2026-11-20', { soreness: 2.5 })).rejects.toThrow('1 to 5');
    expect(await db.dayNotes.count()).toBe(0);
  });

  it('tapping the chosen number again clears it', () => {
    expect(nextRating(null, 3)).toBe(3);
    expect(nextRating(3, 4)).toBe(4);
    expect(nextRating(4, 4)).toBeNull();
  });

  it('two quick taps on the same number set it and then clear it', async () => {
    const db = await freshDb();
    await Promise.all([tapDayRating(db, '2026-11-20', 'energy', 4), tapDayRating(db, '2026-11-20', 'energy', 4)]);
    expect((await getDayNote(db, '2026-11-20')).energy).toBeNull();
    await tapDayRating(db, '2026-11-20', 'energy', 2);
    expect((await getDayNote(db, '2026-11-20')).energy).toBe(2);
  });

  it('a note emptied of everything is removed', async () => {
    const db = await freshDb();
    await saveDayNote(db, '2026-11-20', { energy: 2, note: 'x' });
    await saveDayNote(db, '2026-11-20', { energy: null, note: '  ' });
    expect(await db.dayNotes.get('2026-11-20')).toBeUndefined();
  });

  it('works on a rest day with no workout', async () => {
    const db = await freshDb();
    await saveDayNote(db, '2026-11-22', { soreness: 5 });
    expect((await getDayNote(db, '2026-11-22')).soreness).toBe(5);
  });
});

describe('workout note in history', () => {
  it("an exercise's history carries each workout's note", async () => {
    const db = await freshDb();
    const bench = await exerciseId(db, 'Bench press');
    const s = await startOrResume(db, { date: '2026-11-20', planId: await planId(db, 'Push'), time: 'morning' });
    await logSet(db, { sessionId: s, exerciseId: bench, planExerciseId: null, setNumber: 1, parts: [{ weightLb: 135, reps: 8, seconds: null }] });
    await setSessionNote(db, s, 'Left shoulder tight');
    expect((await exerciseHistory(db, bench))[0].session.journalNote).toBe('Left shoulder tight');
  });
});

describe('calendar marks', () => {
  it('marks dates with a day note or a workout note, not empty ones', async () => {
    const db = await freshDb();
    const push = await planId(db, 'Push');
    const a = await startOrResume(db, { date: '2026-11-03', planId: push, time: 'morning' });
    await setSessionNote(db, a, 'Good pump');
    await startOrResume(db, { date: '2026-11-04', planId: push, time: 'morning' }); // no note
    await saveDayNote(db, '2026-11-05', { energy: 3 });
    const marks = await datesWithNotes(db, ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
    expect([...marks].sort()).toEqual(['2026-11-03', '2026-11-05']);
  });
});
