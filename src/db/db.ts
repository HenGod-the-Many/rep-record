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
  /**
   * Set on a one-date copy of a plan (made when one date's workout is edited).
   * Hidden copies are not listed with the user's plans.
   */
  hidden?: boolean;
  /** For a one-date copy: the plan it was copied from. */
  sourcePlanId?: string | null;
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

/** When in the day a workout is planned: a named part of the day or a clock time "HH:MM". */
export type WorkoutTime = 'morning' | 'noon' | 'evening' | 'night' | string;

/** One workout planned on a day. */
export interface PlannedWorkout {
  planId: string;
  time: WorkoutTime;
}

export interface SplitDay {
  id: string;
  splitId: string;
  /** 0 .. cycleDays-1 */
  dayIndex: number;
  /** Empty = rest day. */
  workouts: PlannedWorkout[];
}

/** A split placed on the calendar from startDate for lengthDays. */
export interface Schedule {
  id: string;
  splitId: string;
  /** ISO date, YYYY-MM-DD */
  startDate: string;
  lengthDays: number;
  createdAt: number;
  /** Cycle position of startDate (0 = day 1). Lets a moved schedule continue its sequence. */
  offset: number;
}

/** A hand-made change to one date. Empty workouts = rest. */
export interface DateOverride {
  date: string;
  workouts: PlannedWorkout[];
}

export interface Session {
  id: string;
  date: string;
  /** The planned workout's time, so two workouts on one day stay apart. */
  time: WorkoutTime;
  planId: string | null;
  /** Snapshot so the session still reads correctly if the plan is renamed or deleted. */
  planName: string;
  splitId: string | null;
  journalNote: string;
  startedAt: number;
  /** null while the workout is open. */
  finishedAt: number | null;
  /** Session-only swaps: plan slot id -> substitute exercise id. The plan is unchanged. */
  swaps: Record<string, string>;
}

/** One stretch of a set at one weight. A set whose weight changed mid-set has several. */
export interface SetPart {
  /** Stored in pounds at full precision; kg is a display conversion. null = no weight (bodyweight, timed). */
  weightLb: number | null;
  reps: number | null;
  seconds: number | null;
}

/** One performed set. History, PRs and pre-fill always key on exerciseId. */
export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  /** The plan slot this set filled, if any (records session-only swaps). */
  planExerciseId: string | null;
  setNumber: number;
  /** At least one. */
  parts: SetPart[];
  /** 1 (very easy) to 10 (couldn't do another rep), or null if not given. */
  difficulty: number | null;
  /** The set was taken to failure. */
  toFailure: boolean;
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
    // v2: several timed workouts per day, schedule offsets (W-05/W-14).
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const toWorkouts = (planId: string | null | undefined): PlannedWorkout[] =>
          planId ? [{ planId, time: 'morning' }] : [];
        await tx
          .table('splitDays')
          .toCollection()
          .modify((d: SplitDay & { planId?: string | null }) => {
            d.workouts = toWorkouts(d.planId);
            delete d.planId;
          });
        await tx
          .table('dateOverrides')
          .toCollection()
          .modify((d: DateOverride & { planId?: string | null }) => {
            d.workouts = toWorkouts(d.planId);
            delete d.planId;
          });
        await tx
          .table('schedules')
          .toCollection()
          .modify((s: Schedule) => {
            if (typeof s.offset !== 'number') s.offset = 0;
          });
      });
    // v3: set parts (weight changes mid-set), difficulty, to failure; open/finished sessions (W-06).
    this.version(3)
      .stores({ sessions: 'id, date, planId, [date+planId]' })
      .upgrade(async (tx) => {
        await tx
          .table('setLogs')
          .toCollection()
          .modify((l: SetLog & { weightLb?: number | null; reps?: number | null; seconds?: number | null }) => {
            if (!Array.isArray(l.parts)) {
              l.parts = [{ weightLb: l.weightLb ?? null, reps: l.reps ?? null, seconds: l.seconds ?? null }];
            }
            delete l.weightLb;
            delete l.reps;
            delete l.seconds;
            if (l.difficulty === undefined) l.difficulty = null;
            if (typeof l.toFailure !== 'boolean') l.toFailure = false;
          });
        await tx
          .table('sessions')
          .toCollection()
          .modify((x: Session) => {
            if (!x.time) x.time = 'morning';
            if (typeof x.startedAt !== 'number') x.startedAt = 0;
            // Sessions from before this version are treated as finished.
            if (x.finishedAt === undefined) x.finishedAt = x.startedAt;
            if (!x.swaps) x.swaps = {};
          });
      });
  }
}

export const db = new WorkoutDB();
