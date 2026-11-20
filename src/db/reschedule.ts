import type { DateOverride, PlannedWorkout, Schedule, Split, SplitDay, WorkoutDB } from './db';
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
  /** A schedule or a hand-made change covers this date (so an empty day is a real rest day). */
  planned: boolean;
}

export interface MovePreview {
  week: string[];
  before: WeekDay[];
  after: WeekDay[];
  /**
   * The moved day first, then every other planned day from the earlier of the two
   * dates to the end of the week, in order. Drop choices index into this.
   */
  sequence: MoveUnit[];
  /** Units that would land past the end of the week with the drop choice given. */
  overflow: MoveUnit[];
  /** Units dropped by the choice given. */
  dropped: MoveUnit[];
  /** How many units would not fit if nothing were dropped (decides whether to ask what to cut). */
  rawOverflow: number;
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
 * new date (later or earlier). Every other planned day from the earlier of the
 * two dates on keeps its order and moves later only as far as needed to stay
 * after the one before it, so rest days (and the day the move left empty)
 * absorb the push.
 */
export async function previewMoveWithinWeek(
  db: WorkoutDB,
  fromDate: string,
  toDate: string,
  opts: MoveOptions = {},
): Promise<MovePreview> {
  if (daysBetween(fromDate, toDate) === 0) throw new ValidationError('Pick a different date.');
  const week = weekDates(fromDate, await getWeekStart(db));
  const f = week.indexOf(fromDate);
  const t = week.indexOf(toDate);
  if (t < 0) throw new ValidationError('"Within the week" can only move to a day in this same week. Use "All future" to go further.');

  const [data, names] = await Promise.all([loadCalendar(db), planNames(db)]);
  const days = week.map((d) => resolveFrom(data, d));
  if (days[f].workouts.length === 0) throw new ValidationError('There is nothing planned on that day to move.');

  const start = Math.min(f, t);
  const unit = (i: number): MoveUnit => ({ from: i, workouts: days[i].workouts, label: labelOf(days[i].workouts, names) });
  const sequence: MoveUnit[] = [unit(f)];
  for (let i = start; i < 7; i++) {
    if (i !== f && days[i].workouts.length > 0) sequence.push(unit(i));
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

  const before: WeekDay[] = days.map((d) => ({
    date: d.date,
    workouts: d.workouts,
    label: labelOf(d.workouts, names),
    planned: d.scheduled || d.overridden,
  }));
  const after: WeekDay[] = before.map((d, i) => {
    if (i < start) return d;
    const w = placed.get(i)?.workouts ?? [];
    return { date: d.date, workouts: w, label: labelOf(w, names), planned: d.planned || w.length > 0 };
  });
  // Only days a schedule or a hand-made change covers count as rest days.
  const rest = (list: WeekDay[]) => list.slice(t).filter((d) => d.planned && d.workouts.length === 0).length;
  let rawOverflow = 0;
  let last = -1;
  sequence.forEach((u, k) => {
    last = Math.max(k === 0 ? t : u.from, last + 1);
    if (last > 6) rawOverflow++;
  });
  const restBefore = rest(before);
  const restAfter = rest(after);
  return { week, before, after, sequence, overflow, dropped, rawOverflow, restBefore, restAfter, restAlert: restAfter < restBefore };
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
 * Shift everything from fromDate on by the gap to toDate, later or earlier. The
 * schedule continues its sequence from toDate, so rest days and order are kept
 * and the schedule ends that many days later (or sooner). Hand-made changes in
 * the moved stretch move with it. Moving later, the dates left behind become
 * rest days; moving earlier, the moved days replace what was planned there.
 */
export async function moveAllFuture(db: WorkoutDB, fromDate: string, toDate: string): Promise<void> {
  const n = daysBetween(fromDate, toDate);
  if (n === 0) throw new ValidationError('Pick a different date.');
  await db.transaction('rw', [db.schedules, db.splits, db.splitDays, db.dateOverrides], async () => {
    const data = await loadCalendar(db);
    const s = scheduleFor(data, fromDate);
    if (!s) throw new ValidationError('There is no schedule on that date to move.');
    const i = daysBetween(s.startDate, fromDate);
    const end = addDays(s.startDate, s.lengthDays);

    // Days before the move that stay: up to fromDate when moving later, up to toDate when earlier.
    const keep = n > 0 ? i : Math.max(0, i + n);
    if (keep === 0) {
      await db.schedules.update(s.id, { startDate: toDate, lengthDays: s.lengthDays - i, offset: s.offset + i });
    } else {
      await db.schedules.update(s.id, { lengthDays: keep });
      await db.schedules.add({
        id: newId(),
        splitId: s.splitId,
        startDate: toDate,
        lengthDays: s.lengthDays - i,
        createdAt: s.createdAt,
        offset: s.offset + i,
      });
    }

    const all = await db.dateOverrides.toArray();
    const moving = all.filter((o) => o.date >= fromDate && o.date < end);
    // Moving earlier: hand-made changes on the days the sequence now covers are replaced.
    const covered = n < 0 ? all.filter((o) => o.date >= toDate && o.date < fromDate) : [];
    await db.dateOverrides.bulkDelete([...moving, ...covered].map((o) => o.date));
    await db.dateOverrides.bulkPut(moving.map((o) => ({ ...o, date: addDays(o.date, n) })));
    // Moving later: the days left behind become rest.
    for (let k = 0; k < n; k++) await db.dateOverrides.put({ date: addDays(fromDate, k), workouts: [] });
  });
}

// ---------- Undo ----------

export interface Snapshot {
  schedules: Schedule[];
  overrides: DateOverride[];
  splits: Split[];
  splitDays: SplitDay[];
}

/** Everything a move or a day edit can change, so it can be put back. */
export async function takeSnapshot(db: WorkoutDB): Promise<Snapshot> {
  const [schedules, overrides, splits, splitDays] = await Promise.all([
    db.schedules.toArray(),
    db.dateOverrides.toArray(),
    db.splits.toArray(),
    db.splitDays.toArray(),
  ]);
  return { schedules, overrides, splits, splitDays };
}

export async function restore(db: WorkoutDB, snap: Snapshot): Promise<void> {
  await db.transaction('rw', [db.schedules, db.dateOverrides, db.splits, db.splitDays], async () => {
    await Promise.all([db.schedules.clear(), db.dateOverrides.clear(), db.splits.clear(), db.splitDays.clear()]);
    await db.schedules.bulkPut(snap.schedules);
    await db.dateOverrides.bulkPut(snap.overrides);
    await db.splits.bulkPut(snap.splits);
    await db.splitDays.bulkPut(snap.splitDays);
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

/**
 * Add a brand-new, empty workout to one date at a time of day, to be built
 * from scratch. It is a one-date workout (not listed with the plans) until it
 * is saved as a plan. Returns its id.
 */
export async function createDateWorkout(db: WorkoutDB, date: string, time: string, name = 'New workout'): Promise<string> {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) throw new ValidationError('Give the workout a name.');
  return db.transaction('rw', [db.schedules, db.splits, db.splitDays, db.dateOverrides, db.plans], async () => {
    const day = resolveFrom(await loadCalendar(db), date);
    const id = newId();
    await db.plans.add({ id, name: n, notes: '', hidden: true, sourcePlanId: null });
    await setDateWorkouts(db, date, [...day.workouts, { planId: id, time }]);
    return id;
  });
}

/** Write a date's edited copy back into the plan it came from, everywhere. */
export async function updatePlanEverywhere(db: WorkoutDB, copyId: string): Promise<void> {
  await db.transaction('rw', [db.plans, db.planExercises, db.dateOverrides, db.sessions], async () => {
    const copy = await db.plans.get(copyId);
    if (!copy?.hidden) throw new ValidationError('This workout is not a one-date copy.');
    const sourceId = copy.sourcePlanId;
    if (!sourceId || !(await db.plans.get(sourceId))) {
      throw new ValidationError('The original plan no longer exists. Save this as a new plan instead.');
    }
    await db.planExercises.where('planId').equals(sourceId).delete();
    // The copy's entries move across keeping their ids, so sets already logged
    // from this date's workout still belong to their exercise slots.
    await db.planExercises.where('planId').equals(copyId).modify({ planId: sourceId });
    await db.dateOverrides
      .filter((o) => o.workouts.some((w) => w.planId === copyId))
      .modify((o) => {
        o.workouts = o.workouts.map((w) => (w.planId === copyId ? { ...w, planId: sourceId } : w));
      });
    await db.sessions.where('planId').equals(copyId).modify({ planId: sourceId });
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

/**
 * Delete one-date copies that no date uses any more (the date was reset,
 * cleared, replaced or moved). Run at app start, when no Undo is pending that
 * could bring a reference back.
 */
export async function pruneUnusedCopies(db: WorkoutDB): Promise<number> {
  return db.transaction('rw', [db.plans, db.planExercises, db.dateOverrides, db.sessions], async () => {
    const used = new Set((await db.dateOverrides.toArray()).flatMap((o) => o.workouts.map((w) => w.planId)));
    // A copy a workout was logged from stays, so that session still shows its plan.
    for (const s of await db.sessions.toArray()) if (s.planId) used.add(s.planId);
    const orphans = (await db.plans.filter((p) => p.hidden === true).toArray()).filter((p) => !used.has(p.id));
    for (const p of orphans) {
      await db.planExercises.where('planId').equals(p.id).delete();
      await db.plans.delete(p.id);
    }
    return orphans.length;
  });
}

/** The date a one-date copy belongs to, if it is still on the calendar. */
export async function dateOfCopy(db: WorkoutDB, copyId: string): Promise<string | null> {
  const o = await db.dateOverrides.filter((x) => x.workouts.some((w) => w.planId === copyId)).first();
  return o?.date ?? null;
}
