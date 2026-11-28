import { describe, expect, it } from 'vitest';
import type { SetPart } from './db';
import { finishSession, isPaused, logSet, pauseTimer, resumeTimer, startOrResume } from './logging';
import { backupParts, exportData, readBackup, restoreBackup } from './backup';
import { timerMs, type TimedSession, type TimedSet } from './timing';
import { exerciseId, freshDb, planId } from '../test/helpers';

/** The workout timer on the logging screen (W-25 slice 2, R-17.1, R-17.2). */

const S = 1000;
const MIN = 60 * S;
const T0 = Date.parse('2026-11-27T08:00:00');
const at = (sec: number) => T0 + sec * S;
const reps = (n: number): SetPart[] => [{ weightLb: 100, reps: n, seconds: null }];
let n = 0;
const set = (sec: number): TimedSet => ({ id: `t${++n}`, exerciseId: 'bench', parts: reps(10), loggedAt: at(sec) });
const open = (pauses: TimedSession['pauses'] = []): TimedSession => ({ startedAt: T0, finishedAt: null, pauses });

describe('What the timer shows (R-17.1, R-17.2)', () => {
  it('runs from Start: minutes and seconds since Start workout was tapped', () => {
    expect(timerMs(open(), [], at(95), false)).toBe(95 * S);
  });

  it('paused time is not counted, and stays frozen while paused', () => {
    const p = open([{ from: at(60), to: null }]);
    expect(timerMs(p, [], at(60 + 10 * 60), false)).toBe(60 * S);
    const resumed = open([{ from: at(60), to: at(120) }]);
    expect(timerMs(resumed, [], at(180), false)).toBe(120 * S);
  });

  it('keeps running after a tick while target sets remain', () => {
    expect(timerMs(open(), [set(240)], at(300), false)).toBe(300 * S);
  });

  it('stopped at the last target set: shows Start to that tick, however much later it is', () => {
    expect(timerMs(open(), [set(240), set(540)], at(540 + 20 * 60), true)).toBe(540 * S);
  });

  it('an extra set after the stop: the time moves on to the new last tick', () => {
    expect(timerMs(open(), [set(240), set(540), set(700)], at(900), true)).toBe(700 * S);
  });

  it('a finished workout with no ticks shows Start to Finish', () => {
    expect(timerMs({ startedAt: T0, finishedAt: at(1800) }, [], at(5000), true)).toBe(1800 * S);
  });

  it('what it shows while running is what will be counted: no more than 15 minutes after the last tick', () => {
    expect(timerMs(open(), [set(60)], at(60 + 40 * 60), false)).toBe(16 * MIN);
  });
});

describe('Pause and resume are saved with the workout', () => {
  it('pause adds an open pause, resume closes it; pausing twice does nothing', async () => {
    const db = await freshDb();
    const id = await startOrResume(db, { date: '2026-11-27', planId: await planId(db, 'Push'), time: 'morning' });
    await pauseTimer(db, id, at(60));
    await pauseTimer(db, id, at(70));
    let s = (await db.sessions.get(id))!;
    expect(s.pauses).toEqual([{ from: at(60), to: null }]);
    expect(isPaused(s)).toBe(true);
    await resumeTimer(db, id, at(120));
    s = (await db.sessions.get(id))!;
    expect(s.pauses).toEqual([{ from: at(60), to: at(120) }]);
    expect(isPaused(s)).toBe(false);
  });

  it('resume without a pause does nothing', async () => {
    const db = await freshDb();
    const id = await startOrResume(db, { date: '2026-11-27', planId: await planId(db, 'Push'), time: 'morning' });
    await resumeTimer(db, id, at(10));
    expect((await db.sessions.get(id))!.pauses ?? []).toEqual([]);
  });

  it('Finish while paused closes the pause, so the workout still has an end', async () => {
    const db = await freshDb();
    const id = await startOrResume(db, { date: '2026-11-27', planId: await planId(db, 'Push'), time: 'morning' });
    await pauseTimer(db, id, Date.now() - 1000);
    await finishSession(db, id);
    const s = (await db.sessions.get(id))!;
    expect(s.finishedAt).not.toBeNull();
    expect(isPaused(s)).toBe(false);
  });

  it('a backup carries the pauses, and a backup without them still loads', async () => {
    const db = await freshDb();
    const id = await startOrResume(db, { date: '2026-11-27', planId: await planId(db, 'Push'), time: 'morning' });
    await logSet(db, { sessionId: id, exerciseId: await exerciseId(db, 'Bench press'), planExerciseId: null, setNumber: 1, parts: reps(8) });
    await pauseTimer(db, id, at(60));
    await resumeTimer(db, id, at(90));
    const file = backupParts(await exportData(db)).join('');
    const other = await freshDb({ seed: false });
    await restoreBackup(other, readBackup(file, other.verno).backup);
    expect((await other.sessions.get(id))!.pauses).toEqual([{ from: at(60), to: at(90) }]);

    // An older backup: the same file with the pauses taken out.
    const old = JSON.parse(file) as { tables: { sessions: Record<string, unknown>[] } };
    for (const s of old.tables.sessions) delete s.pauses;
    const third = await freshDb({ seed: false });
    await restoreBackup(third, readBackup(JSON.stringify(old), third.verno).backup);
    expect((await third.sessions.get(id))!.pauses).toBeUndefined();
  });
});
