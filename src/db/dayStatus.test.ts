import { describe, expect, it } from 'vitest';
import { dayStatuses } from './dayStatus';
import { finishSession, logSet, startOrResume } from './logging';
import { addWorkoutToDate, clearDate } from './schedule';
import type { WorkoutDB } from './db';
import { exerciseId, freshDb, planId } from '../test/helpers';

async function log(db: WorkoutDB, date: string, plan: string, finish: boolean) {
  const s = await startOrResume(db, { date, planId: await planId(db, plan), time: 'morning', plannedTimes: ['morning'] });
  await logSet(db, { sessionId: s, exerciseId: await exerciseId(db, 'Bench press'), planExerciseId: null, setNumber: 1, parts: [{ weightLb: 135, reps: 5, seconds: null }] });
  if (finish) await finishSession(db, s);
}

const TODAY = '2026-11-19';

describe('calendar day states (W-20, R-16.7)', () => {
  it('done, missed, planned, rest and nothing', async () => {
    const db = await freshDb();
    const push = await planId(db, 'Push');
    await addWorkoutToDate(db, '2026-11-16', push); // past, finished -> done
    await log(db, '2026-11-16', 'Push', true);
    await addWorkoutToDate(db, '2026-11-17', push); // past, started but not finished -> missed
    await log(db, '2026-11-17', 'Push', false);
    await addWorkoutToDate(db, '2026-11-18', push); // past, nothing logged -> missed
    await addWorkoutToDate(db, TODAY, push); // today, not done yet -> planned
    await addWorkoutToDate(db, '2026-11-20', push); // future -> planned
    await clearDate(db, '2026-11-21'); // set to nothing by hand -> rest
    const s = await dayStatuses(db, ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', TODAY, '2026-11-20', '2026-11-21'], TODAY);
    expect(s).toEqual({
      '2026-11-15': 'none',
      '2026-11-16': 'done',
      '2026-11-17': 'missed',
      '2026-11-18': 'missed',
      [TODAY]: 'planned',
      '2026-11-20': 'planned',
      '2026-11-21': 'rest',
    });
  });

  it('a finished workout on a day with nothing planned still shows done; today finished shows done', async () => {
    const db = await freshDb();
    await log(db, '2026-11-14', 'Pull', true); // unplanned extra
    await addWorkoutToDate(db, TODAY, await planId(db, 'Push'));
    await log(db, TODAY, 'Push', true);
    expect(await dayStatuses(db, ['2026-11-14', TODAY], TODAY)).toEqual({ '2026-11-14': 'done', [TODAY]: 'done' });
  });
});
