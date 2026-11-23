import { describe, expect, it } from 'vitest';
import {
  availableCards,
  bodyweightCard,
  chosenCards,
  finishedWorkouts,
  metricCard,
  monthRange,
  moveCard,
  recentPrs,
  setCardShown,
  setsBetween,
  volumeBetween,
  weekRange,
} from './stats';
import { finishSession, logSet, startOrResume } from './logging';
import { saveEntry, setMetricEnabled } from './body';
import { setWeekStart } from './schedule';
import type { SetPart, WorkoutDB } from './db';
import { exerciseId, freshDb, planId } from '../test/helpers';

const w = (weightLb: number, reps: number): SetPart => ({ weightLb, reps, seconds: null });

async function workout(db: WorkoutDB, date: string, sets: [string, SetPart[]][], finish = true, time = 'morning') {
  const s = await startOrResume(db, { date, planId: await planId(db, 'Push'), time, plannedTimes: ['morning', 'evening'] });
  let n = 0;
  for (const [name, parts] of sets) await logSet(db, { sessionId: s, exerciseId: await exerciseId(db, name), planExerciseId: null, setNumber: ++n, parts });
  if (finish) await finishSession(db, s);
  return s;
}

describe('week and month', () => {
  it('the week follows the first-day-of-week setting', async () => {
    const db = await freshDb();
    expect(await weekRange(db, '2026-11-20')).toEqual({ from: '2026-11-16', to: '2026-11-22' }); // Monday start
    await setWeekStart(db, 0);
    expect(await weekRange(db, '2026-11-20')).toEqual({ from: '2026-11-15', to: '2026-11-21' }); // Sunday start
  });

  it('the month is the calendar month', () => {
    expect(monthRange('2026-11-20')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthRange('2026-12-05')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(monthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('card numbers (R-11.1)', () => {
  it('workouts this week and month count finished workouts only', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-16', [['Bench press', [w(135, 5)]]]);
    await workout(db, '2026-11-18', [['Bench press', [w(135, 5)]]]);
    await workout(db, '2026-11-19', [['Bench press', [w(135, 5)]]], false); // still open
    await workout(db, '2026-11-02', [['Bench press', [w(135, 5)]]]); // earlier in the month
    await workout(db, '2026-10-30', [['Bench press', [w(135, 5)]]]); // last month
    const wk = await weekRange(db, '2026-11-20');
    const mo = monthRange('2026-11-20');
    expect(await finishedWorkouts(db, wk.from, wk.to)).toBe(2);
    expect(await finishedWorkouts(db, mo.from, mo.to)).toBe(3);
  });

  it('sets and volume this week; volume counts every part of weight sets only', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-17', [
      ['Bench press', [w(135, 5), w(115, 3)]], // 675 + 345
      ['Bench press', [w(100, 10)]], // 1000
      ['Hanging leg raise', [{ weightLb: null, reps: 20, seconds: null }]], // bodyweight: a set, no volume
    ]);
    await workout(db, '2026-11-10', [['Bench press', [w(200, 5)]]]); // last week
    const { from, to } = await weekRange(db, '2026-11-20');
    expect(await setsBetween(db, from, to)).toBe(3);
    expect(await volumeBetween(db, from, to)).toBe(2020);
  });

  it('recent PRs: newest first, the first session is a starting mark, not a PR', async () => {
    const db = await freshDb();
    await workout(db, '2026-11-02', [['Bench press', [w(135, 5)]]]); // start mark
    await workout(db, '2026-11-05', [['Bench press', [w(140, 3)]]]); // heaviest 140 (e1RM 154 < 157.5: no)
    await workout(db, '2026-11-09', [['Bench press', [w(135, 8)]]]); // e1RM 171 beats 157.5
    await workout(db, '2026-11-12', [['Incline dumbbell press', [w(50, 10)]]]); // first ever: no PR
    const prs = await recentPrs(db);
    expect(prs.map((p) => [p.date, p.name, p.record])).toEqual([
      ['2026-11-09', 'Bench press', 'e1rm'],
      ['2026-11-05', 'Bench press', 'heaviest'],
    ]);
    expect(prs[0].valueLb).toBe(171);
  });

  it('recent PRs keeps only the latest five', async () => {
    const db = await freshDb();
    for (let i = 0; i < 8; i++) await workout(db, `2026-11-${String(i + 1).padStart(2, '0')}`, [['Bench press', [w(100 + i * 5, 5)]]]);
    const prs = await recentPrs(db);
    expect(prs).toHaveLength(5);
    expect(prs[0].date).toBe('2026-11-08');
  });

  it('bodyweight: latest entry, its date and the 7-day average', async () => {
    const db = await freshDb();
    expect(await bodyweightCard(db)).toBeNull();
    await saveEntry(db, 'bodyweight', '2026-11-01', 180);
    await saveEntry(db, 'bodyweight', '2026-11-03', 182);
    expect(await bodyweightCard(db)).toEqual({ valueLb: 182, date: '2026-11-03', averageLb: 181 });
  });

  it('a metric card shows its latest value, or nothing yet', async () => {
    const db = await freshDb();
    await setMetricEnabled(db, 'waist', true);
    expect(await metricCard(db, 'waist')).toMatchObject({ value: null });
    await saveEntry(db, 'waist', '2026-11-20', 33);
    expect(await metricCard(db, 'waist')).toMatchObject({ value: 33, date: '2026-11-20' });
  });
});

describe('choosing cards (R-11.2)', () => {
  it('defaults, then show, hide and reorder; the choice is kept', async () => {
    const db = await freshDb();
    expect((await chosenCards(db)).map((c) => c.id)).toEqual(['workouts-week', 'sets-week', 'recent-prs', 'bodyweight']);
    await setCardShown(db, 'recent-prs', false);
    await moveCard(db, 'bodyweight', -1);
    await moveCard(db, 'bodyweight', -1);
    await setCardShown(db, 'volume-week', true);
    expect((await chosenCards(db)).map((c) => c.id)).toEqual(['bodyweight', 'workouts-week', 'sets-week', 'volume-week']);
    await moveCard(db, 'bodyweight', -1); // already first
    expect((await chosenCards(db))[0].id).toBe('bodyweight');
  });

  it('a metric card disappears with its metric and comes back with it', async () => {
    const db = await freshDb();
    expect((await availableCards(db)).map((c) => c.id)).not.toContain('metric:waist');
    await setMetricEnabled(db, 'waist', true);
    await setCardShown(db, 'metric:waist', true);
    expect((await chosenCards(db)).map((c) => c.id)).toContain('metric:waist');
    await setMetricEnabled(db, 'waist', false);
    expect((await chosenCards(db)).map((c) => c.id)).not.toContain('metric:waist');
    await setCardShown(db, 'sets-week', false); // a save while waist is off keeps it
    await setMetricEnabled(db, 'waist', true);
    expect((await chosenCards(db)).map((c) => c.id)).toEqual(['workouts-week', 'recent-prs', 'bodyweight', 'metric:waist']);
  });
});

describe('speed', () => {
  it('recent PRs over a year of data (300 workouts × 20 sets) takes under half a second', async () => {
    const db = await freshDb();
    const ex = (await db.exercises.filter((e) => e.kind === 'weight').toArray()).slice(0, 10).map((e) => e.id);
    const sessions = [];
    const logs = [];
    for (let i = 0; i < 300; i++) {
      const d = new Date(Date.UTC(2025, 10, 1) + i * 86400000 * 1.2).toISOString().slice(0, 10);
      sessions.push({ id: `s${i}`, date: d, time: 'morning', planId: null, planName: 'Push', splitId: null, journalNote: '', startedAt: i, finishedAt: i, swaps: {} });
      for (let n = 0; n < 20; n++) {
        logs.push({ id: `l${i}-${n}`, sessionId: `s${i}`, exerciseId: ex[n % 10], planExerciseId: null, setNumber: n + 1, parts: [w(100 + (i % 50), 5 + (n % 5))], difficulty: null, toFailure: false, note: '', loggedAt: i * 100 + n });
      }
    }
    await db.sessions.bulkAdd(sessions as never[]);
    await db.setLogs.bulkAdd(logs as never[]);
    const t = performance.now();
    const prs = await recentPrs(db);
    expect(performance.now() - t).toBeLessThan(500);
    expect(prs.length).toBe(5);
  });
});
