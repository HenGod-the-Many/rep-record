import type { WorkoutDB } from './db';
import { newId } from './ids';
import { builtInRows } from './metricsData';
import { SEED_EXERCISES, SEED_PLANS, SEED_SPLIT } from './seedData';

const SEEDED_KEY = 'seeded';

/** Add any built-in body metric that is missing (a new install, or data restored from an older backup). */
export async function ensureBuiltInMetrics(db: WorkoutDB): Promise<void> {
  await db.transaction('rw', db.metrics, async () => {
    for (const row of builtInRows()) if (!(await db.metrics.get(row.id))) await db.metrics.add(row);
  });
}
/** Time given to seeded and newly added workouts until the user picks one. */
export const DEFAULT_TIME = 'morning';

/**
 * Load the brief's seed data the first time the app runs. Safe to call on
 * every start: it checks a flag inside the same transaction, so it never
 * duplicates data even if two tabs start at once.
 */
export async function ensureSeeded(db: WorkoutDB): Promise<boolean> {
  await ensureBuiltInMetrics(db);
  return db.transaction(
    'rw',
    [db.settings, db.exercises, db.plans, db.planExercises, db.splits, db.splitDays],
    async () => {
      if (await db.settings.get(SEEDED_KEY)) return false;

      const exerciseIds = new Map<string, string>();
      for (const e of SEED_EXERCISES) {
        const id = newId();
        exerciseIds.set(e.name, id);
        await db.exercises.add({ id, ...e, archived: false });
      }
      const idOf = (name: string) => {
        const id = exerciseIds.get(name);
        if (!id) throw new Error(`Seed data refers to unknown exercise "${name}"`);
        return id;
      };

      const planIds = new Map<string, string>();
      for (const p of SEED_PLANS) {
        const planId = newId();
        planIds.set(p.name, planId);
        await db.plans.add({ id: planId, name: p.name, notes: '' });
        let order = 0;
        for (const [name, sets, min, max, alternates = [], note = ''] of p.entries) {
          await db.planExercises.add({
            id: newId(),
            planId,
            exerciseId: idOf(name),
            order: order++,
            targetSets: sets,
            repMin: min,
            repMax: max,
            alternateIds: alternates.map(idOf),
            note,
          });
        }
      }

      const splitId = newId();
      await db.splits.add({ id: splitId, name: SEED_SPLIT.name, cycleDays: SEED_SPLIT.cycleDays });
      for (let i = 0; i < SEED_SPLIT.days.length; i++) {
        const planName = SEED_SPLIT.days[i];
        const planId = planName === null ? null : planIds.get(planName);
        if (planId === undefined) throw new Error(`Seed split refers to unknown plan "${planName}"`);
        await db.splitDays.add({
          id: newId(),
          splitId,
          dayIndex: i,
          workouts: planId === null ? [] : [{ planId, time: DEFAULT_TIME }],
        });
      }

      await db.settings.put({ key: SEEDED_KEY, value: true });
      await db.settings.put({ key: 'unit', value: 'lb' });
      await db.settings.put({ key: 'weekStart', value: 1 });
      return true;
    },
  );
}
