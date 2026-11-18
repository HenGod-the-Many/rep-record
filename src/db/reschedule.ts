import type { DateOverride, PlannedWorkout, Schedule, WorkoutDB } from './db';
import { addDays, daysBetween, weekDates } from './dates';
import { ValidationError } from './errors';
import { newId } from './ids';
import { getEntries } from './plans';
import { getWeekStart, loadCalendar, resolveFrom, scheduleFor, setDateWorkouts } from './schedule';

/** One day's workouts, moved as a block. */
export interface MoveUnit {
  /** Position in the week (0 = first day of the week) before the move. */
  from: number;
  workouts: PlannedWorkout[];
  label: string;
}

export interface WeekDay {
  date: string;
  workouts: PlannedWorkout[];
  label: string;
}

export interface MovePreview {
  week: string[];
  before: WeekDay[];
  after: WeekDay[];
  /** The moved day and every later planned day this week, in order. Drop choices index into this. */
  sequence: MoveUnit[];
  /** Units that would land past the end of the week with the drop choice given. */
  overflow: MoveUnit[];
  /** Units dropped by the choice given. */
  dropped: MoveUnit[];
  /** Rest days from the new date to the end of the week, before and after. */
  restBefore: number;
  restAfter: number;
  restAlert: boolean;
}

export interface MoveOptions {
  /** 'trailing' drops whatever would not fit; a list drops those sequence positions. */
  drop?: 'trailing' | number[];
}

async function planNames(db: WorkoutDB) {
  return new Map((await db.plans.toArray()).map((p) => [p.id, p.name]));
}

function labelOf(workouts: PlannedWorkout[], names: Map<string, string>): string {
  return workouts.length === 0 ? 'Rest' : workouts.map((w) => names.get(w.planId) ?? 'Deleted plan').join(' + ');
}

/**
 * Work out a move within the week without saving it. The moved day goes to the
 * new date; each later planned day keeps its order and moves only as far as
 * needed to stay after the one before it, so rest days absorb the push.
 */
export async function previewMoveWithinWeek(
  db: WorkoutDB,
  fromDate: string,
  toDate: string,
  opts: MoveOptions = {},
): Promise<MovePreview> {
  if (daysBetween(fromDate, toDate) <= 0) throw new ValidationError('Pick a later date. Moving a day earlier is not supported yet.');
  const week = weekDates(fromDate, await getWeekStart(db));
  const f = week.indexOf(fromDate);
  const t = week.indexOf(toDate);
  if (t < 0) throw new ValidationError('"Within the week" can only move to a day in this same week. Use "All future" to go further.');

  const [data, names] = await Promise.all([loadCalendar(db), planNames(db)]);
  const days = week.map((d) => resolveFrom(data, d));
  if (days[f].workouts.length === 0) throw new ValidationError('There is nothing planned on that day to move.');

  const sequence: MoveUnit[] = [];
  for (let i = f; i < 7; i++) {
    if (days[i].workouts.length > 0) sequence.push({ from: i, workouts: days[i].workouts, label: labelOf(days[i].workouts, names) });
  }

  const dropSet = new Set(Array.isArray(opts.drop) ? opts.drop : []);
  const placed = new Map<number, MoveUnit>();
  const overflow: MoveUnit[] = [];
  const dropped: MoveUnit[] = sequence.filter((_, k) => dropSet.has(k));
  let prev = -1;
  sequence.forEach((unit, k) => {
    if (dropSet.has(k)) return;
    const pos = Math.max(k === 0 ? t : unit.from, prev + 1);
    prev = pos;
    if (pos > 6) overflow.push(unit);
    else placed.set(pos, unit);
  });
  if (opts.drop === 'trailing') dropped.push(...overflow.splice(0));

  const before: WeekDay[] = days.map((d) => ({ date: d.date, workouts: d.workouts, label: labelOf(d.workouts, names) }));
  const after: WeekDay[] = before.map((d, i) => {
    if (i < f) return d;
    const w = placed.get(i)?.workouts ?? [];
    return { date: d.date, workouts: w, label: labelOf(w, names) };
  });
  const rest = (list: WeekDay[]) => list.slice(t).filter((d) => d.workouts.length === 0).length;
  const restBefore = rest(before);
  const restAfter = rest(after);
  return { week, before, after, sequence, overflow, dropped, restBefore, restAfter, restAlert: restAfter < restBefore };
}

/** Save a move within the week as hand-made changes to the dates it touches. */
export async function applyMoveWithinWeek(db: WorkoutDB, fromDate: string, toDate: string, opts: MoveOptions = {}): Promise<void> {
  await db.transaction('rw', [db.schedules, db.splits, db.splitDays, db.dateOverrides, db.plans, db.settings], async () => {
    const p = await previewMoveWithinWeek(db, fromDate, toDate, opts);
    if (p.overflow.length > 0) {
      throw new ValidationError(`${p.overflow.map((u) => u.label).join(', ')} don't fit before the week ends. Choose what to drop.`);
    }
    for (let i = 0; i < 7; i++) {
      if (JSON.stringify(p.before[i].workouts) !== JSON.stringify(p.after[i].workouts)) {
        await setDateWorkouts(db, p.after[i].date, p.after[i].workouts);
      }
    }
  });
}

/**
 * Shift everything from fromDate on by the gap to toDate. The schedule is cut
 * at fromDate and continues its sequence from toDate, so rest days and order
 * are kept and the schedule ends that many days later. Hand-made changes in the
 * moved stretch move with it. The dates left behind become rest days.
 */
export async function moveAllFuture(db: WorkoutDB, fromDate: string, toDate: string): Promise<void> {
  const n = daysBetween(fromDate, toDate);
  if (n <= 0) throw new ValidationError('Pick a later date. Moving a day earlier is not supported yet.');
  await db.transaction('rw', [db.schedules, db.splits, db.splitDays, db.dateOverrides], async () => {
    const data = await loadCalendar(db);
    const s = scheduleFor(data, fromDate);
    if (!s) throw new ValidationError('There is no schedule on that date to move.');
    const i = daysBetween(s.startDate, fromDate);
    const end = addDays(s.startDate, s.lengthDays);

    if (i === 0) {
      await db.schedules.update(s.id, { startDate: toDate });
    } else {
      await db.schedules.update(s.id, { lengthDays: i });
      await db.schedules.add({
        id: newId(),
        splitId: s.splitId,
        startDate: toDate,
        lengthDays: s.lengthDays - i,
        createdAt: s.createdAt,
        offset: s.offset + i,
      });
    }

    const moving = (await db.dateOverrides.toArray()).filter((o) => o.date >= fromDate && o.date < end);
    await db.dateOverrides.bulkDelete(moving.map((o) => o.date));
    await db.dateOverrides.bulkPut(moving.map((o) => ({ ...o, date: addDays(o.date, n) })));
    for (let k = 0; k < n; k++) await db.dateOverrides.put({ date: addDays(fromDate, k), workouts: [] });
  });
}

// ---------- Undo ----------

export interface Snapshot {
  schedules: Schedule[];
  overrides: DateOverride[];
}

/** Everything a move or a day edit can change, so it can be put back. */
export async function takeSnapshot(db: WorkoutDB): Promise<Snapshot> {
  const [schedules, overrides] = await Promise.all([db.schedules.toArray(), db.dateOverrides.toArray()]);
  return { schedules, overrides };
}

export async function restore(db: WorkoutDB, snap: Snapshot): Promise<void> {
  await db.transaction('rw', [db.schedules, db.dateOverrides], async () => {
    await db.schedules.clear();
    await db.dateOverrides.clear();
    await db.schedules.bulkPut(snap.schedules);
    await db.dateOverrides.bulkPut(snap.overrides);
  });
}

// ---------- Editing one date's workout ----------

/**
 * Give one date its own copy of a workout so it can be edited without touching
 * the plan. Returns the copy's id (the existing copy if the date already has one).
 */
export async function makeDateCopy(db: WorkoutDB, date: string, index: number): Promise<string> {
  return db.transaction('rw', [db.schedules, db.splits, db.splitDays, db.dateOverrides, db.plans, db.planExercises], async () => {
    const day = resolveFrom(await loadCalendar(db), date);
    const w = day.workouts[index];
    if (!w) throw new ValidationError('That workout is no longer on this date.');
    const plan = await db.plans.get(w.planId);
    if (!plan) throw new ValidationError('That plan no longer exists.');
    if (plan.hidden) return plan.id;
    const copyId = newId();
    await db.plans.add({ id: copyId, name: plan.name, notes: plan.notes, hidden: true, sourcePlanId: plan.id });
    for (const e of await getEntries(db, plan.id)) {
      await db.planExercises.add({ ...e, id: newId(), planId: copyId, alternateIds: [...e.alternateIds] });
    }
    const workouts = day.workouts.map((x, i) => (i === index ? { ...x, planId: copyId } : x));
    await setDateWorkouts(db, date, workouts);
    return copyId;
  });
}

/** Write a date's edited copy back into the plan it came from, everywhere. */
export async function updatePlanEverywhere(db: WorkoutDB, copyId: string): Promise<void> {
  await db.transaction('rw', [db.plans, db.planExercises, db.dateOverrides], async () => {
    const copy = await db.plans.get(copyId);
    if (!copy?.hidden) throw new ValidationError('This workout is not a one-date copy.');
    const sourceId = copy.sourcePlanId;
    if (!sourceId || !(await db.plans.get(sourceId))) {
      throw new ValidationError('The original plan no longer exists. Save this as a new plan instead.');
    }
    await db.planExercises.where('planId').equals(sourceId).delete();
    for (const e of await getEntries(db, copyId)) {
      await db.planExercises.add({ ...e, id: newId(), planId: sourceId, alternateIds: [...e.alternateIds] });
    }
    await db.dateOverrides
      .filter((o) => o.workouts.some((w) => w.planId === copyId))
      .modify((o) => {
        o.workouts = o.workouts.map((w) => (w.planId === copyId ? { ...w, planId: sourceId } : w));
      });
    await db.planExercises.where('planId').equals(copyId).delete();
    await db.plans.delete(copyId);
  });
}

/** Turn a date's edited copy into a plan of its own, listed with the others. */
export async function saveCopyAsNewPlan(db: WorkoutDB, copyId: string, name: string): Promise<void> {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) throw new ValidationError('Give the new plan a name.');
  const copy = await db.plans.get(copyId);
  if (!copy?.hidden) throw new ValidationError('This workout is not a one-date copy.');
  await db.plans.update(copyId, { name: n, hidden: false, sourcePlanId: null });
}

/** The date a one-date copy belongs to, if it is still on the calendar. */
export async function dateOfCopy(db: WorkoutDB, copyId: string): Promise<string | null> {
  const o = await db.dateOverrides.filter((x) => x.workouts.some((w) => w.planId === copyId)).first();
  return o?.date ?? null;
}
