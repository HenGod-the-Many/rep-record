import type { Plan, Session, SetLog, WorkoutDB } from './db';
import { averageMs, countedMs, exerciseTimes, type KindOf } from './timing';

/**
 * Average times (W-25, R-17.4): the mean of the last 5 times an exercise or a
 * workout was done, from the timing model. A workout still in progress today is
 * left out, since its time is not complete yet.
 */

const newestFirst = (a: Session, b: Session) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1);
const inProgress = (s: Session, today: string) => s.finishedAt === null && s.date === today;

async function kinds(db: WorkoutDB): Promise<KindOf> {
  const map = new Map((await db.exercises.toArray()).map((e) => [e.id, e.kind]));
  return (id) => map.get(id) ?? 'weight';
}

/** An exercise's average time per workout it was done in (history follows the exercise). Null if never done. */
export async function exerciseAverageMs(db: WorkoutDB, exerciseId: string, today: string): Promise<number | null> {
  const ids = [...new Set((await db.setLogs.where('exerciseId').equals(exerciseId).toArray()).map((l) => l.sessionId))];
  const sessions = (await db.sessions.bulkGet(ids))
    .filter((s): s is Session => !!s && !inProgress(s, today))
    .sort(newestFirst)
    .slice(0, 5);
  if (!sessions.length) return null;
  const kindOf = await kinds(db);
  const logs = await db.setLogs.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray();
  return averageMs(sessions.map((s) => exerciseTimes(s, logs.filter((l) => l.sessionId === s.id), kindOf).get(exerciseId) ?? 0));
}

/** Each workout's average timed duration, by plan id. A one-date copy counts toward the workout it was copied from. */
export async function workoutAverages(db: WorkoutDB, today: string): Promise<Map<string, number>> {
  const plans = await db.plans.toArray();
  const source = new Map(plans.map((p) => [p.id, p.hidden && p.sourcePlanId ? p.sourcePlanId : p.id]));
  const byPlan = new Map<string, Session[]>();
  for (const s of await db.sessions.toArray()) {
    if (!s.planId || inProgress(s, today)) continue;
    const key = source.get(s.planId) ?? s.planId;
    byPlan.set(key, [...(byPlan.get(key) ?? []), s]);
  }
  const recent = [...byPlan.values()].flatMap((list) => list.sort(newestFirst).slice(0, 5));
  const logs = recent.length ? await db.setLogs.where('sessionId').anyOf(recent.map((s) => s.id)).toArray() : [];
  const bySession = new Map<string, SetLog[]>();
  for (const l of logs) bySession.set(l.sessionId, [...(bySession.get(l.sessionId) ?? []), l]);
  const kindOf = await kinds(db);
  const out = new Map<string, number>();
  for (const [planId, list] of byPlan) {
    const avg = averageMs(list.sort(newestFirst).slice(0, 5).map((s) => countedMs(s, bySession.get(s.id) ?? [], kindOf)));
    if (avg !== null) out.set(planId, avg);
  }
  return out;
}

/** "about 42 min" (at least 1 min). */
export function aboutMinutes(ms: number): string {
  return `about ${Math.max(1, Math.round(ms / 60_000))} min`;
}

/** The average for a plan, looking through a one-date copy to the workout it was copied from. */
export function averageFor(averages: Map<string, number>, plan: Pick<Plan, 'id' | 'hidden' | 'sourcePlanId'> | undefined): number | undefined {
  if (!plan) return undefined;
  return averages.get(plan.hidden && plan.sourcePlanId ? plan.sourcePlanId : plan.id);
}
