/**
 * Built-in activities (W-15) with fixed ids, so the first-launch seed, the
 * version-6 upgrade and restored backups agree. MET values are the standard
 * moderate-effort values; each can be changed on the exercise.
 */
export const BUILT_IN_ACTIVITIES = [
  { id: 'activity-run', name: 'Run', muscleGroup: 'Cardio', equipment: '', kind: 'activity' as const, hasDistance: true, met: 9.8 },
  { id: 'activity-walk', name: 'Walk', muscleGroup: 'Cardio', equipment: '', kind: 'activity' as const, hasDistance: true, met: 3.5 },
  { id: 'activity-bike', name: 'Bike', muscleGroup: 'Cardio', equipment: '', kind: 'activity' as const, hasDistance: true, met: 7.5 },
  { id: 'activity-hike', name: 'Hike', muscleGroup: 'Cardio', equipment: '', kind: 'activity' as const, hasDistance: true, met: 6.0 },
  { id: 'activity-swim', name: 'Swim', muscleGroup: 'Cardio', equipment: '', kind: 'activity' as const, hasDistance: true, met: 7.0 },
  { id: 'activity-row', name: 'Row', muscleGroup: 'Cardio', equipment: '', kind: 'activity' as const, hasDistance: true, met: 7.0 },
  { id: 'activity-elliptical', name: 'Elliptical', muscleGroup: 'Cardio', equipment: '', kind: 'activity' as const, hasDistance: false, met: 5.0 },
];

export const DEFAULT_MET = 5.0;
