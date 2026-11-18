import { WorkoutDB } from '../db/db';
import { ensureSeeded } from '../db/seed';

let n = 0;

/** A fresh, uniquely named database for one test. */
export async function freshDb(opts: { seed?: boolean } = {}): Promise<WorkoutDB> {
  const db = new WorkoutDB(`test-${Date.now()}-${n++}`);
  await db.open();
  if (opts.seed !== false) await ensureSeeded(db);
  return db;
}

export async function exerciseId(db: WorkoutDB, name: string): Promise<string> {
  const e = await db.exercises.filter((x) => x.name === name).first();
  if (!e) throw new Error(`No exercise named ${name}`);
  return e.id;
}

export async function planId(db: WorkoutDB, name: string): Promise<string> {
  const p = await db.plans.filter((x) => x.name === name).first();
  if (!p) throw new Error(`No plan named ${name}`);
  return p.id;
}
