import type { DateOverride, PlannedWorkout, Schedule, SplitDay, WorkoutDB } from './db';
import { addDays, daysBetween, fromDayNum, isClockTime, TIME_SLOTS, timeSortKey, toDayNum } from './dates';
import { ValidationError } from './errors';
import { newId } from './ids';
import { DEFAULT_TIME } from './seed';

export const MAX_CYCLE_DAYS = 84;
export const MAX_SCHEDULE_DAYS = 3660;

/** What a date holds once splits, schedules and hand-made changes are combined. */
export interface DayPlan {
  date: string;
  /** In time order. Empty = rest (when scheduled or overridden) or nothing. */
  workouts: PlannedWorkout[];
  /** A schedule covers this date. */
  scheduled: boolean;
  /** A hand-made change decides this date. */
  overridden: boolean;
  /** The schedule covering this date, if any. */
  scheduleId: string | null;
}

function sortWorkouts(w: PlannedWorkout[]): PlannedWorkout[] {
  return [...w].sort((a, b) => timeSortKey(a.time) - timeSortKey(b.time));
}

function checkTime(time: string): string {
  if (TIME_SLOTS.some((s) => s.value === time) || isClockTime(time)) return time;
  throw new ValidationError('Pick morning, noon, evening, night, or a clock time.');
}

/** A real calendar date in YYYY-MM-DD form, or a ValidationError. */
export function checkDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || fromDayNum(toDayNum(date)) !== date) throw new ValidationError('Pick a date.');
  return date;
}

function cleanName(name: string, what: string): string {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) throw new ValidationError(`Give the ${what} a name.`);
  return n;
}

function checkCycle(days: number): number {
  if (!Number.isInteger(days) || days < 1 || days > MAX_CYCLE_DAYS) {
    throw new ValidationError(`A cycle is 1 to ${MAX_CYCLE_DAYS} days (12 weeks).`);
  }
  return days;
}

// ---------- Splits ----------

export async function listSplits(db: WorkoutDB) {
  return (await db.splits.toArray()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSplitDays(db: WorkoutDB, splitId: string): Promise<SplitDay[]> {
  return db.splitDays.where('[splitId+dayIndex]').between([splitId, -Infinity], [splitId, Infinity]).toArray();
}

export async function createSplit(db: WorkoutDB, name: string, cycleDays: number): Promise<string> {
  const id = newId();
  const n = cleanName(name, 'split');
  const len = checkCycle(cycleDays);
  await db.transaction('rw', [db.splits, db.splitDays], async () => {
    await db.splits.add({ id, name: n, cycleDays: len });
    for (let i = 0; i < len; i++) await db.splitDays.add({ id: newId(), splitId: id, dayIndex: i, workouts: [] });
  });
  return id;
}

export async function renameSplit(db: WorkoutDB, splitId: string, name: string): Promise<void> {
  await db.splits.update(splitId, { name: cleanName(name, 'split') });
}

/** Lengthen (new days are rest) or shorten (trailing days are removed) the cycle. */
export async function setCycleLength(db: WorkoutDB, splitId: string, cycleDays: number): Promise<void> {
  const len = checkCycle(cycleDays);
  await db.transaction('rw', [db.splits, db.splitDays], async () => {
    const days = await getSplitDays(db, splitId);
    for (const d of days) if (d.dayIndex >= len) await db.splitDays.delete(d.id);
    for (let i = days.length; i < len; i++) await db.splitDays.add({ id: newId(), splitId, dayIndex: i, workouts: [] });
    await db.splits.update(splitId, { cycleDays: len });
  });
}

export async function setSplitDayWorkouts(db: WorkoutDB, splitDayId: string, workouts: PlannedWorkout[]): Promise<void> {
  const clean = workouts.map((w) => ({ planId: w.planId, time: checkTime(w.time) }));
  await db.splitDays.update(splitDayId, { workouts: sortWorkouts(clean) });
}

export async function duplicateSplit(db: WorkoutDB, splitId: string): Promise<string> {
  return db.transaction('rw', [db.splits, db.splitDays], async () => {
    const split = await db.splits.get(splitId);
    if (!split) throw new ValidationError('That split no longer exists.');
    const id = newId();
    const taken = new Set((await db.splits.toArray()).map((s) => s.name));
    const base = `${split.name.replace(/ \(copy(?: \d+)?\)$/, '')} (copy)`;
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base.slice(0, -1)} ${n})`;
    await db.splits.add({ id, name, cycleDays: split.cycleDays });
    for (const d of await getSplitDays(db, splitId)) {
      await db.splitDays.add({ id: newId(), splitId: id, dayIndex: d.dayIndex, workouts: d.workouts.map((w) => ({ ...w })) });
    }
    return id;
  });
}

/**
 * Delete a split, its days, and any schedules that put it on the calendar
 * (those dates then show nothing, unless another schedule covers them).
 * The screen warns first and offers Undo right after.
 */
export async function deleteSplit(db: WorkoutDB, splitId: string): Promise<void> {
  await db.transaction('rw', [db.splits, db.splitDays, db.schedules], async () => {
    await db.schedules.where('splitId').equals(splitId).delete();
    await db.splitDays.where('splitId').equals(splitId).delete();
    await db.splits.delete(splitId);
  });
}

// ---------- Schedules ----------

export async function listSchedules(db: WorkoutDB, splitId?: string): Promise<Schedule[]> {
  const all = splitId ? await db.schedules.where('splitId').equals(splitId).toArray() : await db.schedules.toArray();
  return all.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Put a split on the calendar from startDate for lengthDays. Newest schedule wins where they overlap. */
export async function scheduleSplit(db: WorkoutDB, splitId: string, startDate: string, lengthDays: number): Promise<string> {
  checkDate(startDate);
  if (!Number.isInteger(lengthDays) || lengthDays < 1 || lengthDays > MAX_SCHEDULE_DAYS) {
    throw new ValidationError('The length must be at least 1 day and at most 10 years.');
  }
  return db.transaction('rw', [db.splits, db.schedules], async () => {
    if (!(await db.splits.get(splitId))) throw new ValidationError('That split no longer exists.');
    const id = newId();
    const latest = Math.max(0, ...(await db.schedules.toArray()).map((s) => s.createdAt));
    await db.schedules.add({ id, splitId, startDate, lengthDays, createdAt: Math.max(Date.now(), latest + 1), offset: 0 });
    return id;
  });
}

export async function deleteSchedule(db: WorkoutDB, scheduleId: string): Promise<void> {
  await db.schedules.delete(scheduleId);
}

// ---------- Resolving dates ----------

export interface CalendarData {
  schedules: Schedule[];
  daysBySplit: Map<string, Map<number, SplitDay>>;
  cycleBySplit: Map<string, number>;
  overrides: Map<string, DateOverride>;
}

export async function loadCalendar(db: WorkoutDB): Promise<CalendarData> {
  const [schedules, splits, days, overrides] = await Promise.all([
    db.schedules.toArray(),
    db.splits.toArray(),
    db.splitDays.toArray(),
    db.dateOverrides.toArray(),
  ]);
  const daysBySplit = new Map<string, Map<number, SplitDay>>();
  for (const d of days) {
    if (!daysBySplit.has(d.splitId)) daysBySplit.set(d.splitId, new Map());
    daysBySplit.get(d.splitId)!.set(d.dayIndex, d);
  }
  return {
    schedules: schedules.sort((a, b) => b.createdAt - a.createdAt), // newest first
    daysBySplit,
    cycleBySplit: new Map(splits.map((s) => [s.id, s.cycleDays])),
    overrides: new Map(overrides.map((o) => [o.date, o])),
  };
}

/** The schedule that decides a date (newest covering it), ignoring hand-made changes. */
export function scheduleFor(data: CalendarData, date: string): Schedule | null {
  for (const s of data.schedules) {
    const i = daysBetween(s.startDate, date);
    if (i >= 0 && i < s.lengthDays) return s;
  }
  return null;
}

export function scheduledWorkouts(data: CalendarData, date: string): { schedule: Schedule | null; workouts: PlannedWorkout[] } {
  const s = scheduleFor(data, date);
  if (!s) return { schedule: null, workouts: [] };
  const cycle = data.cycleBySplit.get(s.splitId) ?? 0;
  if (cycle < 1) return { schedule: s, workouts: [] };
  const index = (((daysBetween(s.startDate, date) + s.offset) % cycle) + cycle) % cycle;
  return { schedule: s, workouts: data.daysBySplit.get(s.splitId)?.get(index)?.workouts ?? [] };
}

export function resolveFrom(data: CalendarData, date: string): DayPlan {
  const { schedule, workouts } = scheduledWorkouts(data, date);
  const override = data.overrides.get(date);
  return {
    date,
    workouts: sortWorkouts(override ? override.workouts : workouts),
    scheduled: schedule !== null,
    overridden: override !== undefined,
    scheduleId: schedule?.id ?? null,
  };
}

export async function resolveDate(db: WorkoutDB, date: string): Promise<DayPlan> {
  return resolveFrom(await loadCalendar(db), date);
}

/** Every date from `from` up to (not including) `to`. */
export async function resolveRange(db: WorkoutDB, from: string, to: string): Promise<DayPlan[]> {
  const data = await loadCalendar(db);
  const n = daysBetween(from, to);
  return Array.from({ length: Math.max(0, n) }, (_, i) => resolveFrom(data, addDays(from, i)));
}

// ---------- Hand-made changes to one date ----------

/** Set exactly what a date holds; the split and schedules are untouched. */
export async function setDateWorkouts(db: WorkoutDB, date: string, workouts: PlannedWorkout[]): Promise<void> {
  checkDate(date);
  const clean = workouts.map((w) => ({ planId: w.planId, time: checkTime(w.time) }));
  await db.dateOverrides.put({ date, workouts: sortWorkouts(clean) });
}

/** Back to what the schedule says. */
export async function resetDate(db: WorkoutDB, date: string): Promise<void> {
  await db.dateOverrides.delete(date);
}

/** Make the date a rest day. */
export async function clearDate(db: WorkoutDB, date: string): Promise<void> {
  await setDateWorkouts(db, date, []);
}

async function editDate(db: WorkoutDB, date: string, edit: (w: PlannedWorkout[]) => PlannedWorkout[]) {
  await db.transaction('rw', [db.schedules, db.splits, db.splitDays, db.dateOverrides, db.plans], async () => {
    const current = await resolveDate(db, date);
    await setDateWorkouts(db, date, edit(current.workouts.map((w) => ({ ...w }))));
  });
}

export async function replaceWorkout(db: WorkoutDB, date: string, index: number, planId: string): Promise<void> {
  await editDate(db, date, (w) => {
    if (!w[index]) throw new ValidationError('That workout is no longer on this date.');
    w[index] = { ...w[index], planId };
    return w;
  });
}

export async function addWorkoutToDate(db: WorkoutDB, date: string, planId: string, time: string = DEFAULT_TIME): Promise<void> {
  await editDate(db, date, (w) => [...w, { planId, time }]);
}

export async function removeWorkoutFromDate(db: WorkoutDB, date: string, index: number): Promise<void> {
  await editDate(db, date, (w) => w.filter((_, i) => i !== index));
}

export async function setWorkoutTime(db: WorkoutDB, date: string, index: number, time: string): Promise<void> {
  await editDate(db, date, (w) => {
    if (!w[index]) throw new ValidationError('That workout is no longer on this date.');
    w[index] = { ...w[index], time };
    return w;
  });
}

// ---------- Week start ----------

export async function getWeekStart(db: WorkoutDB): Promise<number> {
  const v = (await db.settings.get('weekStart'))?.value;
  return typeof v === 'number' && v >= 0 && v <= 6 ? v : 1;
}

export async function setWeekStart(db: WorkoutDB, day: number): Promise<void> {
  if (!Number.isInteger(day) || day < 0 || day > 6) throw new ValidationError('Pick a day of the week.');
  await db.settings.put({ key: 'weekStart', value: day });
}
