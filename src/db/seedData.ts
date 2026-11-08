import type { ExerciseKind } from './db';

/**
 * Seed data, transcribed from the project brief ("Seed data" section).
 * Exercises are referenced by name below; names must match exactly.
 */

export interface SeedExercise {
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: ExerciseKind;
}

export const SEED_EXERCISES: SeedExercise[] = [
  // Push
  { name: 'Bench press', muscleGroup: 'Chest', equipment: 'Barbell', kind: 'weight' },
  { name: 'Incline dumbbell press', muscleGroup: 'Chest', equipment: 'Dumbbell', kind: 'weight' },
  { name: 'Machine fly', muscleGroup: 'Chest', equipment: 'Machine', kind: 'weight' },
  { name: 'Cable lateral raise', muscleGroup: 'Shoulders', equipment: 'Cable', kind: 'weight' },
  { name: 'Dumbbell skull crushers', muscleGroup: 'Triceps', equipment: 'Dumbbell', kind: 'weight' },
  { name: 'Rope tricep extensions', muscleGroup: 'Triceps', equipment: 'Cable', kind: 'weight' },
  // Pull
  { name: 'Lat pulldown', muscleGroup: 'Back', equipment: 'Cable', kind: 'weight' },
  { name: 'Machine row', muscleGroup: 'Back', equipment: 'Machine', kind: 'weight' },
  { name: 'Straight-arm pulldown', muscleGroup: 'Back', equipment: 'Cable', kind: 'weight' },
  { name: 'Face pulls', muscleGroup: 'Shoulders', equipment: 'Cable', kind: 'weight' },
  { name: 'Dumbbell shrugs', muscleGroup: 'Traps', equipment: 'Dumbbell', kind: 'weight' },
  { name: 'Preacher curl', muscleGroup: 'Biceps', equipment: 'EZ bar', kind: 'weight' },
  { name: 'Incline curl', muscleGroup: 'Biceps', equipment: 'Dumbbell', kind: 'weight' },
  // Legs & Abs
  { name: 'Leg press', muscleGroup: 'Quads', equipment: 'Machine', kind: 'weight' },
  { name: 'Squat', muscleGroup: 'Quads', equipment: 'Barbell', kind: 'weight' },
  { name: 'Romanian deadlift', muscleGroup: 'Hamstrings', equipment: 'Barbell', kind: 'weight' },
  { name: 'Leg extension', muscleGroup: 'Quads', equipment: 'Machine', kind: 'weight' },
  { name: 'Standing calf raise', muscleGroup: 'Calves', equipment: 'Machine', kind: 'weight' },
  { name: 'Hanging leg raise', muscleGroup: 'Abs', equipment: 'Bodyweight', kind: 'bodyweight' },
  { name: 'Cable crunch', muscleGroup: 'Abs', equipment: 'Cable', kind: 'weight' },
  { name: 'Plank', muscleGroup: 'Abs', equipment: 'Bodyweight', kind: 'timed' },
  // Chest, Back, Arms
  { name: 'Dumbbell press', muscleGroup: 'Chest', equipment: 'Dumbbell', kind: 'weight' },
  { name: 'Barbell row', muscleGroup: 'Back', equipment: 'Barbell', kind: 'weight' },
  { name: 'Cable fly', muscleGroup: 'Chest', equipment: 'Cable', kind: 'weight' },
  { name: 'Cable row', muscleGroup: 'Back', equipment: 'Cable', kind: 'weight' },
  { name: 'Overhead cable tricep extension', muscleGroup: 'Triceps', equipment: 'Cable', kind: 'weight' },
  { name: 'Hammer curl', muscleGroup: 'Biceps', equipment: 'Dumbbell', kind: 'weight' },
  { name: 'Wrist curls', muscleGroup: 'Forearms', equipment: 'Dumbbell', kind: 'weight' },
  { name: 'Decline sit-up', muscleGroup: 'Abs', equipment: 'Bodyweight', kind: 'bodyweight' },
  { name: 'Ab wheel', muscleGroup: 'Abs', equipment: 'Ab wheel', kind: 'bodyweight' },
  // Shoulders & Legs
  { name: 'Shoulder press', muscleGroup: 'Shoulders', equipment: 'Dumbbell', kind: 'weight' },
  { name: 'Hack squat', muscleGroup: 'Quads', equipment: 'Machine', kind: 'weight' },
  { name: 'Dumbbell lateral raise', muscleGroup: 'Shoulders', equipment: 'Dumbbell', kind: 'weight' },
  { name: 'Leg curl', muscleGroup: 'Hamstrings', equipment: 'Machine', kind: 'weight' },
  { name: 'Back extension', muscleGroup: 'Lower back', equipment: 'Bodyweight', kind: 'bodyweight' },
  { name: 'Rear delt fly', muscleGroup: 'Shoulders', equipment: 'Machine', kind: 'weight' },
  { name: 'Walking lunges', muscleGroup: 'Quads', equipment: 'Dumbbell', kind: 'weight' },
];

/** [exercise, sets, min, max, alternates?, note?] — min/max are seconds for timed exercises. */
export type SeedEntry = [string, number, number, number, string[]?, string?];

export interface SeedPlan {
  name: string;
  entries: SeedEntry[];
}

export const SEED_PLANS: SeedPlan[] = [
  {
    name: 'Push',
    entries: [
      ['Bench press', 4, 6, 8],
      ['Incline dumbbell press', 3, 8, 10],
      ['Machine fly', 3, 12, 15],
      ['Cable lateral raise', 3, 12, 15],
      ['Dumbbell skull crushers', 3, 10, 12],
      ['Rope tricep extensions', 3, 12, 15],
    ],
  },
  {
    name: 'Pull',
    entries: [
      ['Lat pulldown', 4, 8, 10],
      ['Machine row', 3, 8, 10],
      ['Straight-arm pulldown', 3, 12, 15],
      ['Face pulls', 3, 15, 20],
      ['Dumbbell shrugs', 3, 10, 12],
      ['Preacher curl', 3, 10, 12],
      ['Incline curl', 3, 10, 12],
    ],
  },
  {
    name: 'Legs & Abs',
    entries: [
      ['Leg press', 4, 8, 10, ['Squat']],
      ['Romanian deadlift', 3, 8, 10],
      ['Leg extension', 3, 12, 15],
      ['Standing calf raise', 4, 12, 15],
      ['Hanging leg raise', 3, 10, 15],
      ['Cable crunch', 3, 12, 15],
      ['Plank', 3, 45, 60],
    ],
  },
  {
    name: 'Chest, Back, Arms',
    entries: [
      ['Dumbbell press', 3, 10, 12],
      ['Barbell row', 4, 8, 10],
      ['Cable fly', 3, 12, 15],
      ['Cable row', 3, 10, 12],
      ['Overhead cable tricep extension', 3, 10, 12],
      ['Hammer curl', 3, 10, 12],
      ['Wrist curls', 3, 12, 15],
      ['Decline sit-up', 3, 10, 15, ['Ab wheel']],
    ],
  },
  {
    name: 'Shoulders & Legs',
    entries: [
      ['Shoulder press', 4, 8, 10],
      ['Hack squat', 4, 8, 10],
      ['Dumbbell lateral raise', 3, 12, 15],
      ['Leg curl', 3, 10, 12],
      ['Back extension', 3, 10, 12],
      ['Rear delt fly', 3, 15, 15],
      ['Walking lunges', 3, 10, 10, [], 'per leg'],
      ['Standing calf raise', 3, 12, 15],
    ],
  },
];

/** Default split: 7-day cycle, Day 1 = Push. null = rest. */
export const SEED_SPLIT = {
  name: '5-day muscle building',
  cycleDays: 7,
  days: ['Push', 'Pull', 'Legs & Abs', null, 'Chest, Back, Arms', 'Shoulders & Legs', null] as (
    | string
    | null
  )[],
};

/** Training rules from the brief, shown as tips. */
export const TIPS = [
  'Rest 2-3 min after the first heavy lift, 60-90 sec after the rest.',
  'Stop sets about 1-2 reps short of failure.',
  'Progression: when you hit the top of the rep range on every set, add a little weight next session.',
  'Fat loss needs a modest calorie deficit and enough protein; the split alone builds muscle.',
];
