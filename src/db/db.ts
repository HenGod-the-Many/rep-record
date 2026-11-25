import Dexie, { type EntityTable } from 'dexie';
import { builtInRows, type MetricKind } from './metricsData';
import { BUILT_IN_ACTIVITIES } from './activityData';

/** How an exercise is measured. */
export type ExerciseKind = 'weight' | 'bodyweight' | 'timed' | 'activity';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: ExerciseKind;
  /** Archived exercises are hidden from pickers but never deleted. */
  archived: boolean;
  /** Activities (W-15): whether a distance is logged. */
  hasDistance?: boolean;
  /** Activities: MET value for the calorie estimate. */
  met?: number;
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
  /** The warm-up routine shown before this plan's workout (W-16), if any. */
  warmupId?: string | null;
  /** The folder this plan is in (W-18); missing or null = not in a folder. */
  folderId?: string | null;
}

/** A folder of plans (W-18). One level: folders don't hold folders. */
export interface Folder {
  id: string;
  name: string;
  order: number;
}

/** One move of a warm-up: reps or a time, never both. Plain text, not a library exercise. */
export interface WarmupMove {
  name: string;
  reps: number | null;
  seconds: number | null;
}

/** A named warm-up routine (W-16). */
export interface Warmup {
  id: string;
  name: string;
  moves: WarmupMove[];
  /** Times through the moves (W-19). Missing = 1. */
  rounds?: number;
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
  /** Activities: target distance in miles (the target minutes are repMin/repMax). */
  targetDistanceMi?: number | null;
  /** Free text shown with the targets, e.g. "per leg". */
  note: string;
  /**
   * Superset or circuit (W-19, decision 0007): members share a key, are
   * consecutive, and each does every round (targetSets = groupRounds).
   */
  groupKey?: string | null;
  groupKind?: GroupKind;
  groupRounds?: number;
}

export type GroupKind = 'superset' | 'circuit';

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
  /** The warm-up's moves as they were when the workout started, so later edits don't change it (W-16). */
  warmupMoves?: WarmupMove[];
  /** Positions checked off; round r's move i is r * warmupMoves.length + i. */
  warmupChecked?: number[];
  /** Rounds of the warm-up as it was at the start (W-19). Missing = 1. */
  warmupRounds?: number;
  /** Plan slot ids in the order they were done (W-17). Missing or empty = the plan's order. The plan is unchanged. */
  slotOrder?: string[];
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
  /** Activities (W-15): duration is parts[0].seconds; effort is difficulty. */
  distanceMi?: number | null;
  avgHr?: number | null;
  /** Calories typed by hand. When empty the screen shows an estimate instead. */
  calories?: number | null;
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

/** A body metric (W-11): built in (bodyweight, height, measurements, body fat, photos) or named by the user. */
export interface Metric {
  id: string;
  name: string;
  kind: MetricKind;
  /** For custom metrics: the unit shown, e.g. "bpm". */
  unit: string;
  builtIn: boolean;
  /** Bodyweight and height cannot be switched off. */
  alwaysOn: boolean;
  enabled: boolean;
  order: number;
}

/** One value of a metric on a date. Weight in pounds, length in inches, percent and custom as typed. */
export interface MetricEntry {
  id: string;
  metricId: string;
  date: string;
  value: number;
}

/** A progress photo, kept only on the phone. */
export interface Photo {
  id: string;
  date: string;
  image: Blob;
  width: number;
  height: number;
  bytes: number;
  addedAt: number;
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
  metrics!: EntityTable<Metric, 'id'>;
  metricEntries!: EntityTable<MetricEntry, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  warmups!: EntityTable<Warmup, 'id'>;
  folders!: EntityTable<Folder, 'id'>;

  /**
   * `upTo` declares only the versions up to that number. It exists so a backup
   * from an older version can be restored through the same upgrade steps the
   * app runs on itself (see backup.ts); the app always uses every version.
   */
  constructor(name = DB_NAME, upTo = Infinity) {
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
    if (upTo < 2) return;
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
    if (upTo < 3) return;
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
    if (upTo < 4) return;
    // v4: body metrics and progress photos (W-11). Built-in metrics are added here for
    // existing data and by ensureSeeded for a new install.
    this.version(4)
      .stores({
        metrics: 'id, order',
        metricEntries: 'id, metricId, date, [metricId+date]',
        photos: 'id, date',
      })
      .upgrade(async (tx) => {
        const t = tx.table('metrics');
        for (const row of builtInRows()) if (!(await t.get(row.id))) await t.add(row);
      });
    if (upTo < 5) return;
    // v5: warm-up routines attached to plans (W-16). New fields are optional, so no data changes.
    this.version(5).stores({ warmups: 'id, name' });
    if (upTo < 6) return;
    // v6: activities as a fourth exercise kind (W-15). Built-in activities are added here
    // for existing data and by ensureSeeded for a new install; an existing exercise with
    // the same name is left alone.
    this.version(6)
      .stores({})
      .upgrade(async (tx) => {
        const t = tx.table('exercises');
        const names = new Set((await t.toArray()).map((e: Exercise) => e.name.trim().toLowerCase()));
        for (const a of BUILT_IN_ACTIVITIES) {
          if (!names.has(a.name.toLowerCase())) await t.add({ ...a, archived: false });
        }
      });
    if (upTo < 7) return;
    // v7: plan folders (W-18). Plan.folderId is optional, so existing plans start outside any folder.
    this.version(7).stores({ folders: 'id, order' });
  }
}

export const db = new WorkoutDB();
