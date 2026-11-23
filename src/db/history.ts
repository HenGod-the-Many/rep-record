import type { ExerciseKind, Session, SetLog, WorkoutDB } from './db';

/**
 * Exercise history, records and chart points (W-08). Everything keys on
 * `SetLog.exerciseId`, never on a plan or split, so sets from any plan, a
 * session-only swap or a workout built from scratch all count.
 */

export interface HistorySession {
  session: Pick<Session, 'id' | 'date' | 'time' | 'planName' | 'startedAt' | 'journalNote'>;
  /** By set number. */
  sets: SetLog[];
}

/** Every logged set of an exercise, grouped by workout, newest workout first. */
export async function exerciseHistory(db: WorkoutDB, exerciseId: string): Promise<HistorySession[]> {
  const logs = await db.setLogs.where('exerciseId').equals(exerciseId).toArray();
  const ids = [...new Set(logs.map((l) => l.sessionId))];
  const sessions = await db.sessions.bulkGet(ids);
  const byId = new Map<string, HistorySession>();
  sessions.forEach((s, i) => {
    // A set whose workout is missing still shows, under an unknown date.
    const session = s ?? { id: ids[i], date: '', time: '', planName: '', startedAt: 0, journalNote: '' };
    byId.set(ids[i], { session, sets: [] });
  });
  for (const l of logs) byId.get(l.sessionId)!.sets.push(l);
  const out = [...byId.values()];
  for (const h of out) h.sets.sort((a, b) => a.setNumber - b.setNumber);
  out.sort((a, b) => (a.session.date === b.session.date ? b.session.startedAt - a.session.startedAt : a.session.date < b.session.date ? 1 : -1));
  return out;
}

/**
 * Estimated 1-rep max by Epley: weight × (1 + reps ÷ 30), only for 1 to 12
 * reps. One rep is the weight itself. Null when it doesn't apply.
 */
export function epley(weightLb: number | null, reps: number | null): number | null {
  if (!weightLb || weightLb <= 0 || !reps || reps < 1 || reps > 12) return null;
  return reps === 1 ? weightLb : weightLb * (1 + reps / 30);
}

export interface Mark {
  value: number;
  date: string;
  /** What gave it, e.g. the weight and reps. */
  weightLb: number | null;
  reps: number | null;
}

export interface Records {
  /** Weight: heaviest weight for at least one rep. Bodyweight: heaviest added weight. */
  heaviest: Mark | null;
  /** Weight exercises only. */
  bestE1rm: Mark | null;
  /** Bodyweight: most reps in one set. */
  mostReps: Mark | null;
  /** Timed: longest hold in one set. Activities: longest duration (seconds). */
  longest: Mark | null;
  /** Activities: longest distance (miles). */
  longestDistance: Mark | null;
}

const totalReps = (l: SetLog) => l.parts.reduce((n, p) => n + (p.reps ?? 0), 0);
const totalSeconds = (l: SetLog) => l.parts.reduce((n, p) => n + (p.seconds ?? 0), 0);

/** Oldest first, so a record keeps the date it was first reached. */
function chronological(history: HistorySession[]): HistorySession[] {
  return [...history].reverse();
}

function better(cur: Mark | null, value: number, date: string, weightLb: number | null, reps: number | null): Mark | null {
  return value > 0 && (!cur || value > cur.value) ? { value, date, weightLb, reps } : cur;
}

/** Records for one exercise. Each part of a set counts on its own, at its own weight. */
export function records(history: HistorySession[], kind: ExerciseKind): Records {
  let heaviest: Mark | null = null;
  let bestE1rm: Mark | null = null;
  let mostReps: Mark | null = null;
  let longest: Mark | null = null;
  let longestDistance: Mark | null = null;
  for (const { session, sets } of chronological(history)) {
    for (const l of sets) {
      if (kind === 'activity') {
        longest = better(longest, totalSeconds(l), session.date, null, null);
        longestDistance = better(longestDistance, l.distanceMi ?? 0, session.date, null, null);
        continue;
      }
      if (kind === 'timed') {
        longest = better(longest, totalSeconds(l), session.date, null, null);
        continue;
      }
      if (kind === 'bodyweight') mostReps = better(mostReps, totalReps(l), session.date, null, totalReps(l));
      for (const p of l.parts) {
        if (!p.reps || p.reps < 1 || !p.weightLb) continue;
        heaviest = better(heaviest, p.weightLb, session.date, p.weightLb, p.reps);
        if (kind === 'weight') {
          const e = epley(p.weightLb, p.reps);
          if (e !== null) bestE1rm = better(bestE1rm, e, session.date, p.weightLb, p.reps);
        }
      }
    }
  }
  return { heaviest, bestE1rm, mostReps, longest, longestDistance };
}

export interface ChartPoint {
  date: string;
  /** Per kind: weight → [heaviest, best e1RM]; bodyweight → [most reps]; timed → [longest seconds]. Null where nothing qualified. */
  values: (number | null)[];
}

/** One point per date (two workouts on one date make one point), oldest first. */
export function chartPoints(history: HistorySession[], kind: ExerciseKind): ChartPoint[] {
  const byDate = new Map<string, HistorySession[]>();
  for (const h of history) {
    if (!h.session.date) continue;
    byDate.set(h.session.date, [...(byDate.get(h.session.date) ?? []), h]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, hs]) => {
      const r = records(hs, kind);
      const values =
        kind === 'weight'
          ? [r.heaviest?.value ?? null, r.bestE1rm?.value ?? null]
          : kind === 'bodyweight'
            ? [r.mostReps?.value ?? null]
            : kind === 'activity'
              ? [r.longest ? Math.round(r.longest.value / 60) : null]
              : [r.longest?.value ?? null];
      return { date, values };
    })
    .filter((p) => p.values.some((v) => v !== null));
}
