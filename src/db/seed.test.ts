import { describe, expect, it } from 'vitest';
import { ensureSeeded } from './seed';
import { getEntries } from './plans';
import { freshDb } from '../test/helpers';

/**
 * The brief's seed lines, copied verbatim from "Workout Journal SPEC.md".
 * Parsed independently of seedData.ts so the test checks the brief, not
 * the code against itself.
 */
const BRIEF: Record<string, string> = {
  Push: 'Bench press 4x6-8, Incline dumbbell press 3x8-10, Machine fly 3x12-15, Cable lateral raise 3x12-15, Dumbbell skull crushers 3x10-12, Rope tricep extensions 3x12-15',
  Pull: 'Lat pulldown 4x8-10, Machine row 3x8-10, Straight-arm pulldown 3x12-15, Face pulls 3x15-20, Dumbbell shrugs 3x10-12, Preacher curl 3x10-12, Incline curl 3x10-12',
  'Legs & Abs':
    'Leg press or squat 4x8-10, Romanian deadlift 3x8-10, Leg extension 3x12-15, Standing calf raise 4x12-15, Hanging leg raise 3x10-15, Cable crunch 3x12-15, Plank 3x45-60 sec',
  'Chest, Back, Arms':
    'Dumbbell press 3x10-12, Barbell row 4x8-10, Cable fly 3x12-15, Cable row 3x10-12, Overhead cable tricep extension 3x10-12, Hammer curl 3x10-12, Wrist curls 3x12-15, Decline sit-up or ab wheel 3x10-15',
  'Shoulders & Legs':
    'Shoulder press 4x8-10, Hack squat 4x8-10, Dumbbell lateral raise 3x12-15, Leg curl 3x10-12, Back extension 3x10-12, Rear delt fly 3x15, Walking lunges 3x10 per leg, Standing calf raise 3x12-15',
};
const BRIEF_SPLIT = 'Mon: Push | Tue: Pull | Wed: Legs & Abs | Thu: Rest | Fri: Chest, Back, Arms | Sat: Shoulders & Legs | Sun: Rest';

interface Expected {
  names: string[]; // first is the main exercise, rest are alternates
  sets: number;
  min: number;
  max: number;
}

function parsePlan(line: string): Expected[] {
  return line.split(', ').map((item) => {
    const m = item.match(/^(.+) (\d+)x(\d+)(?:-(\d+))?(?: sec| per leg)?$/);
    if (!m) throw new Error(`Cannot parse "${item}"`);
    const names = m[1].split(' or ').map((n) => n.charAt(0).toUpperCase() + n.slice(1));
    return { names, sets: +m[2], min: +m[3], max: +(m[4] ?? m[3]) };
  });
}

describe('seed data (R-01.1, R-02.2, R-03.2)', () => {
  it('library holds every exercise named in the brief, once each, with "or" split in two', async () => {
    const db = await freshDb();
    const expected = new Set(Object.values(BRIEF).flatMap((l) => parsePlan(l).flatMap((e) => e.names)));
    const names = (await db.exercises.toArray()).map((e) => e.name);
    expect(new Set(names)).toEqual(expected);
    expect(names.length).toBe(expected.size); // no duplicates
    expect(names).toContain('Squat');
    expect(names).toContain('Ab wheel');
  });

  it('five plans match the brief: exercises, order, sets, ranges and alternates', async () => {
    const db = await freshDb();
    const plans = await db.plans.toArray();
    expect(plans.map((p) => p.name).sort()).toEqual(Object.keys(BRIEF).sort());
    const nameOf = new Map((await db.exercises.toArray()).map((e) => [e.id, e.name]));
    for (const plan of plans) {
      const entries = await getEntries(db, plan.id);
      const actual = entries.map((e) => ({
        names: [nameOf.get(e.exerciseId)!, ...e.alternateIds.map((id) => nameOf.get(id)!)],
        sets: e.targetSets,
        min: e.repMin,
        max: e.repMax,
      }));
      expect(actual, plan.name).toEqual(parsePlan(BRIEF[plan.name]));
    }
  });

  it('plank is timed and walking lunges are marked per leg', async () => {
    const db = await freshDb();
    const plank = await db.exercises.filter((e) => e.name === 'Plank').first();
    expect(plank?.kind).toBe('timed');
    const lunges = await db.exercises.filter((e) => e.name === 'Walking lunges').first();
    const entry = await db.planExercises.where('exerciseId').equals(lunges!.id).first();
    expect(entry?.note).toBe('per leg');
  });

  it('default split is a 7-day cycle matching the brief, starting with Push', async () => {
    const db = await freshDb();
    const splits = await db.splits.toArray();
    expect(splits).toHaveLength(1);
    expect(splits[0].cycleDays).toBe(7);
    const days = (await db.splitDays.where('splitId').equals(splits[0].id).toArray()).sort(
      (a, b) => a.dayIndex - b.dayIndex,
    );
    const planName = new Map((await db.plans.toArray()).map((p) => [p.id, p.name]));
    const actual = days.map((d) => (d.workouts.length === 0 ? 'Rest' : d.workouts.map((w) => planName.get(w.planId)).join(' + ')));
    const expected = BRIEF_SPLIT.split(' | ').map((d) => d.replace(/^\w+: /, ''));
    expect(actual).toEqual(expected);
  });

  it('seeding twice does not duplicate anything', async () => {
    const db = await freshDb();
    const before = [await db.exercises.count(), await db.plans.count(), await db.planExercises.count()];
    expect(await ensureSeeded(db)).toBe(false);
    const after = [await db.exercises.count(), await db.plans.count(), await db.planExercises.count()];
    expect(after).toEqual(before);
  });

  it('defaults the weight unit to pounds', async () => {
    const db = await freshDb();
    expect((await db.settings.get('unit'))?.value).toBe('lb');
  });
});
