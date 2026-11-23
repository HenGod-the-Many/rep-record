import type { ExerciseKind, PlanExercise } from './db/db';

/** "4 × 6–8", "3 × 15", "3 × 45–60 s", "3 × 10 per leg". */
export function formatTargets(entry: Pick<PlanExercise, 'targetSets' | 'repMin' | 'repMax' | 'note'> & { targetDistanceMi?: number | null }, kind: ExerciseKind, displayUnit: 'lb' | 'kg' = 'lb') {
  if (kind === 'activity') {
    // "45 min", "45 min · 12 mi" (km when the unit setting is kg).
    const d = entry.targetDistanceMi;
    const dist = d ? ` · ${Math.round((displayUnit === 'kg' ? d * 1.609344 : d) * 10) / 10} ${displayUnit === 'kg' ? 'km' : 'mi'}` : '';
    return `${entry.repMin} min${dist}`;
  }
  const range = entry.repMin === entry.repMax ? `${entry.repMin}` : `${entry.repMin}–${entry.repMax}`;
  const unit = kind === 'timed' ? ' s' : '';
  const note = entry.note ? ` ${entry.note}` : '';
  return `${entry.targetSets} × ${range}${unit}${note}`;
}

export const KIND_LABEL: Record<ExerciseKind, string> = {
  weight: 'Weight × reps',
  bodyweight: 'Bodyweight reps',
  timed: 'Timed (seconds)',
  activity: 'Activity (time, distance)',
};
