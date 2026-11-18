import Dexie, { type EntityTable } from 'dexie';

/** How an exercise is measured. */
export type ExerciseKind = 'weight' | 'bodyweight' | 'timed';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: ExerciseKind;
  /** Archived exercises are hidden from pickers but never deleted. */
  archived: boolean;
}

export interface Plan {
  id: string;
  name: string;
  notes: string;
}

/** One exercise slot in a plan. For timed exercises repMin/repMax are seconds. */
export interface PlanExercise {
  id: string;
  planId: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  repMin: number;
  repMax: number;
  /** Exercises offered as a quick swap for this slot. */
  alternateIds: string[];
  /** Free text shown with the targets, e.g. "per leg". */
  note: string;
}

export interface Split {
  id: string;
  name: string;
  /** Length of one cycle in days (7 = repeats weekly). */
  cycleDays: number;
}

export interface SplitDay {
  id: string;
  splitId: string;
  /** 0 .. cycleDays-1 */
  dayIndex: number;
  /** null = rest day */
  planId: string | null;
}

/** A split placed on the calendar from startDate for lengthDays. */
export interface Schedule {
  id: string;
  splitId: string;
  /** ISO date, YYYY-MM-DD */
  startDate: string;
  lengthDays: number;
  createdAt: number;
}

/** A one-date change to the schedule. planId null = rest. */
export interface DateOverride {
  date: string;
  planId: string | null;
}

export interface Session {
  id: string;
  date: string;
  planId: string | null;
  /** Snapshot so the session still reads correctly if the plan is renamed or deleted. */
  planName: string;
  splitId: string | null;
  journalNote: string;
}

/** One performed set. History, PRs and pre-fill always key on exerciseId. */
export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  /** The plan slot this set filled, if any (records session-only swaps). */
  planExerciseId: string | null;
  setNumber: number;
  /** Stored in pounds at full precision; kg is a display conversion. */
  weightLb: number | null;
  reps: number | null;
  seconds: number | null;
  note: string;
  loggedAt: number;
}

export interface DayNote {
  date: string;
  energy: number | null;
  sleep: number | null;
  soreness: number | null;
  note: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

export const DB_NAME = 'workout-journal';

export class WorkoutDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  plans!: EntityTable<Plan, 'id'>;
  planExercises!: EntityTable<PlanExercise, 'id'>;
  splits!: EntityTable<Split, 'id'>;
  splitDays!: EntityTable<SplitDay, 'id'>;
  schedules!: EntityTable<Schedule, 'id'>;
  dateOverrides!: EntityTable<DateOverride, 'date'>;
  sessions!: EntityTable<Session, 'id'>;
  setLogs!: EntityTable<SetLog, 'id'>;
  dayNotes!: EntityTable<DayNote, 'date'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      exercises: 'id, name, muscleGroup, archived',
      plans: 'id, name',
      planExercises: 'id, planId, exerciseId, [planId+order]',
      splits: 'id',
      splitDays: 'id, splitId, [splitId+dayIndex]',
      schedules: 'id, splitId, startDate',
      dateOverrides: 'date',
      sessions: 'id, date, planId',
      setLogs: 'id, sessionId, exerciseId, [exerciseId+loggedAt]',
      dayNotes: 'date',
      settings: 'key',
    });
  }
}

export const db = new WorkoutDB();
