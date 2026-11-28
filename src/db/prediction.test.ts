import { describe, expect, it } from 'vitest';
import type { ExerciseKind, SetPart } from './db';
import { paceFrom, predictWorkout, slotMs, timeLeftMs, type Pace, type PlannedSlot, type TimedSession, type TimedSet } from './timing';

/**
 * Known answers for duration predictions (W-22, R-17.7, R-17.8, R-17.11).
 * Times are seconds after Start, so the numbers can be worked out by hand.
 */

const S = 1000;
const MIN = 60 * S;
const T0 = Date.parse('2026-11-26T08:00:00');
const at = (sec: number, day = 0) => T0 + day * 86_400_000 + sec * S;
const reps = (n: number): SetPart[] => [{ weightLb: 100, reps: n, seconds: null }];

let n = 0;
const set = (exerciseId: string, sec: number, day = 0, parts: SetPart[] = reps(10)): TimedSet => ({ id: `p${++n}`, exerciseId, parts, loggedAt: at(sec, day) });
const session = (day = 0): TimedSession => ({ startedAt: at(0, day), finishedAt: null });
const kindOf = (kinds: Record<string, ExerciseKind> = {}) => (id: string): ExerciseKind => kinds[id] ?? 'weight';
const slot = (exerciseId: string, sets: number, repMin = 10, repMax = 10, kind: ExerciseKind = 'weight'): PlannedSlot => ({ exerciseId, kind, sets, repMin, repMax });

describe('Pace from past workouts (R-17.7, R-17.8)', () => {
  // One workout: 5 min of set-up, bench 3 sets two minutes apart, 4 min to the next exercise, rows 2 sets.
  // Ticks: bench 5:30, 7:30, 9:30 (first set 30 s); rows 13:30 (first set 30 s), 15:30.
  const one = { session: session(), sets: [set('bench', 330), set('bench', 450), set('bench', 570), set('row', 810), set('row', 930)] };

  it('time per set is the exercise time over its sets', () => {
    const pace = paceFrom([one], kindOf());
    expect(pace.perSetMs.get('bench')).toBe(((30 + 120 + 120) / 3) * S); // 90 s
    expect(pace.perSetMs.get('row')).toBe(((30 + 120) / 2) * S); // 75 s
  });

  it('set-up is the time before the first set began; between exercises is what is left, per change of exercise', () => {
    const pace = paceFrom([one], kindOf());
    expect(pace.setupMs).toBe(300 * S); // 5:30 tick less the first set's 30 s
    // Workout 930 s - set-up 300 - sets (270 + 150) = 210 s for one change of exercise.
    expect(pace.betweenMs).toBe(210 * S);
  });

  it('uses the newest 5 workouts for each exercise; older ones are left out', () => {
    const history: { session: TimedSession; sets: TimedSet[] }[] = [];
    // Newest first: second sets 60, 120, 180, 240, 300 s after the first; the oldest (600 s, capped 300) is left out.
    const gaps = [60, 120, 180, 240, 300, 600];
    gaps.forEach((g, i) => history.push({ session: session(i), sets: [set('bench', 30, i), set('bench', 30 + g, i)] }));
    const pace = paceFrom(history, kindOf());
    // Per workout: 30 s + gap, over 2 sets. Mean over the newest 5: (30*5 + 900) / 10 = 105 s.
    expect(pace.perSetMs.get('bench')).toBe(105 * S);
  });

  it('with no workouts at all: 5 min set-up and 3 min between exercises', () => {
    const pace = paceFrom([], kindOf());
    expect(pace.setupMs).toBe(5 * MIN);
    expect(pace.betweenMs).toBe(3 * MIN);
    expect(pace.perSetMs.size).toBe(0);
  });
});

describe('Predicting a workout (R-17.7, R-17.8)', () => {
  const pace: Pace = { perSetMs: new Map([['bench', 90 * S], ['row', 75 * S]]), setupMs: 5 * MIN, betweenMs: 4 * MIN };

  it('an exercise done before: its sets × its own time per set', () => {
    expect(slotMs(slot('bench', 4), pace)).toBe(360 * S);
  });

  it('an exercise never done: sets × (reps × 3 s + 2 min rest), using the middle of the rep range', () => {
    expect(slotMs(slot('curl', 3, 8, 12), pace)).toBe(3 * (30 + 120) * S);
  });

  it('a timed exercise never done uses its seconds; a planned activity counts its target minutes once', () => {
    expect(slotMs(slot('plank', 3, 45, 60, 'timed'), pace)).toBe(3 * (52.5 + 120) * S);
    expect(slotMs(slot('run', 1, 20, 30, 'activity'), pace)).toBe(25 * MIN);
  });

  it('straight sets: set-up + each exercise + the time between exercises', () => {
    const p = predictWorkout([[slot('bench', 4)], [slot('row', 3)]], pace);
    expect(p.slotMs).toEqual([[360 * S], [225 * S]]);
    expect(p.totalMs).toBe(5 * MIN + 360 * S + 225 * S + 4 * MIN);
  });

  it('a superset is one block: its members change without "between" time', () => {
    const p = predictWorkout([[slot('bench', 3), slot('row', 3)], [slot('curl', 3)]], pace);
    // Set-up 300 + bench 270 + row 225 + one change 240 + curl 3 × 150.
    expect(p.totalMs).toBe((300 + 270 + 225 + 240 + 450) * S);
  });

  it('an empty workout predicts nothing', () => {
    expect(predictWorkout([], pace).totalMs).toBe(0);
  });
});

describe('Time left during a workout (R-17.11)', () => {
  const pace: Pace = { perSetMs: new Map([['bench', 90 * S], ['row', 75 * S]]), setupMs: 5 * MIN, betweenMs: 4 * MIN };

  it('counts the sets not yet ticked, and a change of exercise for each block not started', () => {
    // Bench 2 of 4 done; rows not started.
    const left = timeLeftMs([[{ slot: slot('bench', 4), done: 2 }], [{ slot: slot('row', 3), done: 0 }]], pace, { ticked: true, elapsedMs: 10 * MIN });
    expect(left).toBe((2 * 90 + 240 + 3 * 75) * S);
  });

  it('before the first tick, what is left of the set-up counts too', () => {
    const left = timeLeftMs([[{ slot: slot('bench', 2), done: 0 }]], pace, { ticked: false, elapsedMs: 2 * MIN });
    expect(left).toBe((180 + 180) * S); // 3 min of set-up left + 2 sets
  });

  it('nothing left once every target set is ticked', () => {
    expect(timeLeftMs([[{ slot: slot('bench', 2), done: 3 }]], pace, { ticked: true, elapsedMs: 0 })).toBe(0);
  });
});
