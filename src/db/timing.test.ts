import { describe, expect, it } from 'vitest';
import type { ExerciseKind, Pause, SetPart } from './db';
import {
  averageMs,
  countedMs,
  exerciseTimes,
  MAX_SET_MS,
  pausedMs,
  setTimes,
  workoutEnd,
  workoutMs,
  type TimedSession,
  type TimedSet,
} from './timing';

/**
 * Known answers for the timing model (W-25, R-17.3, R-17.5). Times are in
 * seconds from Start workout, so the expected numbers can be worked out by hand.
 */

const S = 1000;
const MIN = 60 * S;
const T0 = Date.parse('2026-11-26T08:00:00');
const at = (sec: number) => T0 + sec * S;

const reps = (n: number): SetPart[] => [{ weightLb: 100, reps: n, seconds: null }];
const secs = (n: number): SetPart[] => [{ weightLb: null, reps: null, seconds: n }];

let n = 0;
/** A set of `exerciseId` ticked `sec` seconds after Start. */
const set = (exerciseId: string, sec: number, parts: SetPart[] = reps(10)): TimedSet => ({
  id: `s${++n}`,
  exerciseId,
  parts,
  loggedAt: at(sec),
});

const session = (opts: { finishSec?: number | null; pauses?: Pause[] } = {}): TimedSession => ({
  startedAt: T0,
  finishedAt: opts.finishSec == null ? null : at(opts.finishSec),
  pauses: opts.pauses,
});

const kinds = (entries: Record<string, ExerciseKind> = {}) => (id: string): ExerciseKind => entries[id] ?? 'weight';

describe('Per-set and per-exercise time (R-17.3)', () => {
  it('straight sets: the first set gets 3 s per rep, the others the time since the previous tick', () => {
    // Warm-up and set-up for 4 minutes, then 3 sets of 10, ticked at 4:00, 6:30 and 9:00.
    const sets = [set('bench', 240), set('bench', 390), set('bench', 540)];
    const t = setTimes(session(), sets, kinds());
    expect(sets.map((s) => t.get(s.id))).toEqual([30 * S, 150 * S, 150 * S]);
    expect(exerciseTimes(session(), sets, kinds()).get('bench')).toBe(330 * S);
  });

  it('the first set gets the time since Start when that is shorter than 3 s per rep', () => {
    const sets = [set('bench', 20)]; // 10 reps = 30 s, but only 20 s passed
    expect(setTimes(session(), sets, kinds()).get(sets[0].id)).toBe(20 * S);
  });

  it('an alternating superset: each exercise gets only the time before its own ticks, and the two add up', () => {
    // Shrugs and preacher curls alternate: S 1:00, C 2:00, S 3:30, C 4:30, S 6:00, C 7:00.
    const sets = [
      set('shrug', 60, reps(12)),
      set('curl', 120, reps(8)),
      set('shrug', 210, reps(12)),
      set('curl', 270, reps(8)),
      set('shrug', 360, reps(12)),
      set('curl', 420, reps(8)),
    ];
    const t = exerciseTimes(session(), sets, kinds());
    // Shrugs: 36 (12 × 3) + 90 + 90. Curls: 24 (8 × 3; 60 s passed) + 60 + 60.
    expect(t.get('shrug')).toBe(216 * S);
    expect(t.get('curl')).toBe(144 * S);
    // Together they are the time from the first set's start (1:00 - 36 s = 0:24) to the last tick (7:00),
    // less what the curls' first set could not use (60 - 24 = 36 s).
    expect(t.get('shrug')! + t.get('curl')!).toBe((420 - 24 - 36) * S);
  });

  it('a circuit of three exercises, two rounds', () => {
    const sets = [
      set('a', 30, reps(10)), // first of a: 30 s
      set('b', 90, reps(5)), // first of b: 15 s (60 s passed)
      set('c', 150, secs(40)), // first of c, a timed set: its own 40 s
      set('a', 240), // 90 s
      set('b', 300), // 60 s
      set('c', 380, secs(40)), // 80 s
    ];
    const t = exerciseTimes(session(), sets, kinds({ c: 'timed' }));
    expect(t.get('a')).toBe(120 * S);
    expect(t.get('b')).toBe(75 * S);
    expect(t.get('c')).toBe(120 * S);
  });

  it('an exercise added mid-workout is handled the same way', () => {
    const sets = [set('bench', 30), set('bench', 150), set('dips', 300, reps(15)), set('dips', 420, reps(15))];
    const t = exerciseTimes(session(), sets, kinds());
    expect(t.get('bench')).toBe(150 * S);
    expect(t.get('dips')).toBe((45 + 120) * S);
  });

  it('paused time is not given to any set', () => {
    // Set 1 at 0:30, paused from 1:00 to 11:00, set 2 at 12:00: set 2 gets 90 s, not 690 s.
    const pauses = [{ from: at(60), to: at(660) }];
    const sets = [set('bench', 30), set('bench', 720)];
    const t = setTimes(session({ pauses }), sets, kinds());
    expect(t.get(sets[1].id)).toBe(90 * S);
  });

  it('one set is given at most 5 minutes (phone put down)', () => {
    const sets = [set('bench', 30), set('bench', 30 + 12 * 60)];
    expect(setTimes(session(), sets, kinds()).get(sets[1].id)).toBe(MAX_SET_MS);
  });

  it('an activity counts its own logged time, without the 5-minute limit', () => {
    const sets = [set('run', 1900, secs(30 * 60))];
    expect(exerciseTimes(session(), sets, kinds({ run: 'activity' })).get('run')).toBe(30 * MIN);
  });

  it('sets are taken in tick order whatever order they are given in', () => {
    const a = set('bench', 30);
    const b = set('bench', 150);
    expect(setTimes(session(), [b, a], kinds()).get(b.id)).toBe(120 * S);
  });
});

describe('Workout time (R-17.2, R-17.5)', () => {
  it('ends at the last tick, not at Finish', () => {
    const sets = [set('bench', 240), set('bench', 540)];
    const s = session({ finishSec: 540 + 20 * 60 });
    expect(workoutEnd(s, sets)).toBe(at(540));
    expect(workoutMs(s, sets)).toBe(540 * S);
  });

  it('a workout with no ticks ends at Finish; an open one with none has no time yet', () => {
    expect(workoutMs(session({ finishSec: 1800 }), [])).toBe(1800 * S);
    expect(workoutMs(session(), [])).toBe(0);
  });

  it('pauses are taken out, including one never resumed', () => {
    const sets = [set('bench', 30), set('bench', 900)];
    const s = session({ pauses: [{ from: at(100), to: at(400) }] });
    expect(workoutMs(s, sets)).toBe(600 * S);
    expect(pausedMs([{ from: at(100), to: null }], at(0), at(250))).toBe(150 * S);
  });

  it('an unfinished workout with ticks counts up to its last tick', () => {
    expect(workoutMs(session(), [set('bench', 30), set('bench', 600)])).toBe(600 * S);
  });

  it('minutes exercised: an activity inside a workout is inside its time', () => {
    const sets = [set('bench', 60), set('run', 1260, secs(15 * 60))];
    expect(countedMs(session({ finishSec: 1300 }), sets, kinds({ run: 'activity' }))).toBe(1260 * S);
  });

  it('minutes exercised: an activity-only workout never finished counts its logged activity time', () => {
    const sets = [set('run', 120, secs(40 * 60))];
    expect(countedMs(session(), sets, kinds({ run: 'activity' }))).toBe(40 * MIN);
  });

  it('minutes exercised: the activity-only rule holds when the clock ran longer than the activity', () => {
    // Started at 8:00, a 30-minute run typed in at 10:00, never finished: 30 minutes, not 2 hours.
    const sets = [set('run', 2 * 3600, secs(30 * 60))];
    expect(countedMs(session(), sets, kinds({ run: 'activity' }))).toBe(30 * MIN);
  });

  it('a stretch of more than 15 minutes between two ticks counts 15 (a forgotten tick, caught up at Finish)', () => {
    // Sets at 4:00 and 8:00; the last set ticked an hour later at 1:08:00: 4 + 4 + 15 = 23 minutes.
    const sets = [set('rope', 240), set('rope', 480), set('rope', 480 + 60 * 60)];
    expect(workoutMs(session({ finishSec: 480 + 60 * 60 + 4 }), sets)).toBe(23 * MIN);
  });

  it('the 15-minute limit applies to time on the clock, after pauses are taken out', () => {
    // 30 minutes between ticks, 20 of them paused: 10 minutes count.
    const sets = [set('bench', 60), set('bench', 60 + 30 * 60)];
    const s = session({ pauses: [{ from: at(120), to: at(120 + 20 * 60) }] });
    expect(workoutMs(s, sets)).toBe(11 * MIN);
  });

  it('time from Start to the first tick is not limited (warm-up, setting up)', () => {
    expect(workoutMs(session(), [set('bench', 20 * 60)])).toBe(20 * MIN);
  });

  it('a long logged activity is never cut: a 6-hour hike counts 6 hours', () => {
    const sets = [set('hike', 60, secs(6 * 3600))];
    expect(countedMs(session({ finishSec: 120 }), sets, kinds({ hike: 'activity' }))).toBe(6 * 60 * MIN);
  });

  it('a workout counts at most 4 hours (carried over from the old rule)', () => {
    expect(workoutMs(session({ finishSec: 6 * 3600 }), [])).toBe(4 * 60 * MIN);
  });

  it('minutes exercised: a workout left open with no ticks counts nothing', () => {
    expect(countedMs(session(), [], kinds())).toBe(0);
  });
});

describe('Averages (R-17.4)', () => {
  it('is the mean of the last 5, newest first; older ones are ignored', () => {
    expect(averageMs([10, 20, 30, 40, 50, 1000])).toBe(30);
    expect(averageMs([60, 120])).toBe(90);
  });

  it('leaves out zero times and has no average with none', () => {
    expect(averageMs([0, 100, 0, 200])).toBe(150);
    expect(averageMs([])).toBeNull();
    expect(averageMs([0])).toBeNull();
  });
});
