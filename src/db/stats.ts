import type { Exercise, Metric, Session, SetLog, WorkoutDB } from './db';
import { addDays, weekDates } from './dates';
import { epley } from './history';
import { latestEntry, listMetrics, rollingAverage, entriesFor } from './body';
import { getWeekStart } from './schedule';

/**
 * Stats overview (W-12): one number (or short list) per card, and which cards
 * Taylor shows, in what order. The week follows the "first day of the week"
 * setting (R-03.7); the month is the calendar month.
 */

export type CardId = string;
export const CARDS_KEY = 'statsCards';
export const DEFAULT_CARDS: CardId[] = ['workouts-week', 'sets-week', 'recent-prs', 'bodyweight'];

export interface CardInfo {
  id: CardId;
  label: string;
}

const FIXED: CardInfo[] = [
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'workouts-week', label: 'Workouts this week' },
  { id: 'workouts-month', label: 'Workouts this month' },
  { id: 'sets-week', label: 'Sets this week' },
  { id: 'volume-week', label: 'Volume this week' },
  { id: 'recent-prs', label: 'Recent PRs' },
];

/** Every card that can be shown now: the fixed ones plus one per switched-on metric (not bodyweight or photos). */
export async function availableCards(db: WorkoutDB): Promise<CardInfo[]> {
  const metrics = (await listMetrics(db)).filter((m) => (m.alwaysOn || m.enabled) && m.kind !== 'photos' && m.id !== 'bodyweight');
  return [...FIXED, ...metrics.map((m) => ({ id: `metric:${m.id}`, label: m.name }))];
}

/** The chosen cards in order, leaving out any that aren't available right now (a switched-off metric). */
export async function chosenCards(db: WorkoutDB): Promise<CardInfo[]> {
  const saved = (await db.settings.get(CARDS_KEY))?.value;
  const ids = Array.isArray(saved) ? (saved as CardId[]) : DEFAULT_CARDS;
  const avail = new Map((await availableCards(db)).map((c) => [c.id, c]));
  return ids.filter((id) => avail.has(id)).map((id) => avail.get(id)!);
}

/** Save the whole list of shown cards, in order. Unavailable ids already saved are kept, so a metric switched back on returns. */
export async function saveCards(db: WorkoutDB, shown: CardId[]): Promise<void> {
  const saved = (await db.settings.get(CARDS_KEY))?.value;
  const before = Array.isArray(saved) ? (saved as CardId[]) : DEFAULT_CARDS;
  const avail = new Set((await availableCards(db)).map((c) => c.id));
  const hiddenButKept = before.filter((id) => !avail.has(id) && !shown.includes(id));
  await db.settings.put({ key: CARDS_KEY, value: [...shown, ...hiddenButKept] });
}

export async function setCardShown(db: WorkoutDB, id: CardId, shown: boolean): Promise<void> {
  const ids = (await chosenCards(db)).map((c) => c.id).filter((x) => x !== id);
  await saveCards(db, shown ? [...ids, id] : ids);
}

export async function moveCard(db: WorkoutDB, id: CardId, direction: -1 | 1): Promise<void> {
  const ids = (await chosenCards(db)).map((c) => c.id);
  const i = ids.indexOf(id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await saveCards(db, ids);
}

// ---------- numbers ----------

/** Lifting kinds: sets of these count as sets; activities (W-15) do not. */
const LIFTING = new Set(['weight', 'bodyweight', 'timed']);

export async function weekRange(db: WorkoutDB, today: string): Promise<{ from: string; to: string }> {
  const days = weekDates(today, await getWeekStart(db));
  return { from: days[0], to: days[6] };
}

export function monthRange(today: string): { from: string; to: string } {
  const from = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(next, -1) };
}

async function sessionsBetween(db: WorkoutDB, from: string, to: string): Promise<Session[]> {
  return db.sessions.where('date').between(from, to, true, true).toArray();
}

export async function finishedWorkouts(db: WorkoutDB, from: string, to: string): Promise<number> {
  return (await sessionsBetween(db, from, to)).filter((s) => s.finishedAt !== null).length;
}

async function liftingSetsBetween(db: WorkoutDB, from: string, to: string): Promise<{ sets: SetLog[]; kinds: Map<string, Exercise['kind']> }> {
  const sessions = await sessionsBetween(db, from, to);
  const sets = sessions.length ? await db.setLogs.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray() : [];
  const kinds = new Map((await db.exercises.toArray()).map((e) => [e.id, e.kind as string]));
  return { sets: sets.filter((l) => LIFTING.has(kinds.get(l.exerciseId) ?? '')), kinds: kinds as Map<string, Exercise['kind']> };
}

export async function setsBetween(db: WorkoutDB, from: string, to: string): Promise<number> {
  return (await liftingSetsBetween(db, from, to)).sets.length;
}

/** Sum of weight × reps over every part of every weight set, in pounds. Bodyweight and timed sets are left out. */
export async function volumeBetween(db: WorkoutDB, from: string, to: string): Promise<number> {
  const { sets, kinds } = await liftingSetsBetween(db, from, to);
  let total = 0;
  for (const l of sets) {
    if (kinds.get(l.exerciseId) !== 'weight') continue;
    for (const p of l.parts) total += (p.weightLb ?? 0) * (p.reps ?? 0);
  }
  return total;
}

export interface PrEvent {
  exerciseId: string;
  name: string;
  date: string;
  /** Which record: the heaviest weight, or the best estimated 1-rep max. */
  record: 'heaviest' | 'e1rm';
  valueLb: number;
}

/**
 * The most recent new records across weight exercises, newest first. An
 * exercise's first-ever session sets its starting mark and is not a PR; after
 * that, beating the heaviest weight or the best estimated 1-rep max is.
 */
export async function recentPrs(db: WorkoutDB, limit = 5): Promise<PrEvent[]> {
  const exercises = new Map((await db.exercises.toArray()).filter((e) => e.kind === 'weight').map((e) => [e.id, e]));
  const sessions = new Map((await db.sessions.toArray()).map((s) => [s.id, s]));
  const byExercise = new Map<string, SetLog[]>();
  for (const l of await db.setLogs.toArray()) {
    if (!exercises.has(l.exerciseId) || !sessions.has(l.sessionId)) continue;
    byExercise.set(l.exerciseId, [...(byExercise.get(l.exerciseId) ?? []), l]);
  }
  const events: PrEvent[] = [];
  for (const [exId, logs] of byExercise) {
    // Group by workout, oldest first.
    const bySession = new Map<string, SetLog[]>();
    for (const l of logs) bySession.set(l.sessionId, [...(bySession.get(l.sessionId) ?? []), l]);
    const ordered = [...bySession.entries()].sort(([a], [b]) => {
      const sa = sessions.get(a)!;
      const sb = sessions.get(b)!;
      return sa.date === sb.date ? sa.startedAt - sb.startedAt : sa.date < sb.date ? -1 : 1;
    });
    let heaviest = 0;
    let best = 0;
    ordered.forEach(([sid, ls], i) => {
      let h = 0;
      let e = 0;
      for (const l of ls) {
        for (const p of l.parts) {
          if (!p.weightLb || !p.reps || p.reps < 1) continue;
          h = Math.max(h, p.weightLb);
          e = Math.max(e, epley(p.weightLb, p.reps) ?? 0);
        }
      }
      const date = sessions.get(sid)!.date;
      const name = exercises.get(exId)!.name;
      if (i > 0 && h > heaviest) events.push({ exerciseId: exId, name, date, record: 'heaviest', valueLb: h });
      if (i > 0 && e > best && e > 0) events.push({ exerciseId: exId, name, date, record: 'e1rm', valueLb: e });
      heaviest = Math.max(heaviest, h);
      best = Math.max(best, e);
    });
  }
  return events.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)).slice(0, limit);
}

/** Latest bodyweight, its date, and the 7-day average on that date. */
export async function bodyweightCard(db: WorkoutDB): Promise<{ valueLb: number; date: string; averageLb: number } | null> {
  const entries = await entriesFor(db, 'bodyweight');
  if (entries.length === 0) return null;
  const avg = rollingAverage(entries.slice(0, 7 * 4));
  const last = avg[avg.length - 1];
  return { valueLb: entries[0].value, date: entries[0].date, averageLb: last.value };
}

export async function metricCard(db: WorkoutDB, metricId: string): Promise<{ metric: Metric; value: number; date: string } | { metric: Metric; value: null; date: null } | null> {
  const metric = await db.metrics.get(metricId);
  if (!metric) return null;
  const e = await latestEntry(db, metricId);
  return e ? { metric, value: e.value, date: e.date } : { metric, value: null, date: null };
}
