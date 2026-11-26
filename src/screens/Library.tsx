import type { ReactNode } from 'react';
import { navigate } from '../router';
import { LargeTitle, SegmentedSwitch } from '../ui/components';

/**
 * Library (W-20, R-16.5): Programs · Workouts · Exercises · Warm-ups behind one
 * switch. Each part keeps its old route (/splits, /plans, /exercises,
 * /warmups), so old links still work; only the words on screen changed.
 */
export type LibraryPart = 'programs' | 'workouts' | 'exercises' | 'warmups';

export const LIBRARY_PATHS: Record<LibraryPart, string> = {
  programs: '/splits',
  workouts: '/plans',
  exercises: '/exercises',
  warmups: '/warmups',
};

const OPTIONS: { value: LibraryPart; label: string }[] = [
  { value: 'programs', label: 'Programs' },
  { value: 'workouts', label: 'Workouts' },
  { value: 'exercises', label: 'Exercises' },
  { value: 'warmups', label: 'Warm-ups' },
];

const KEY = 'rr-library';

/** The Library tab reopens the part last used. */
export function lastLibraryPath(): string {
  try {
    const v = localStorage.getItem(KEY) as LibraryPart | null;
    return v && v in LIBRARY_PATHS ? LIBRARY_PATHS[v] : LIBRARY_PATHS.programs;
  } catch {
    return LIBRARY_PATHS.programs;
  }
}

function remember(part: LibraryPart) {
  try {
    localStorage.setItem(KEY, part);
  } catch {
    // not kept; the tab falls back to Programs
  }
}

export function LibraryTop({ part, action }: { part: LibraryPart; action?: ReactNode }) {
  remember(part);
  return (
    <>
      <LargeTitle title="Library" action={action} />
      <SegmentedSwitch label="Library section" options={OPTIONS} value={part} onChange={(p) => navigate(LIBRARY_PATHS[p], { replace: true })} />
    </>
  );
}
