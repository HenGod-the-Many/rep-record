import type { ExerciseKind, SetLog, SetPart } from './db';
import { formatWeight, type Unit } from './units';
import { formatDistance } from './activities';

/** How good one part is, for picking the best set: heavier first, then more reps (or seconds). */
function score(p: SetPart, kind: ExerciseKind): [number, number] {
  if (kind === 'timed') return [p.seconds ?? 0, 0];
  if (kind === 'bodyweight') return [p.weightLb ?? 0, p.reps ?? 0];
  return [p.weightLb ?? 0, p.reps ?? 0];
}

function better(a: [number, number], b: [number, number]): boolean {
  return a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
}

function partText(p: SetPart, kind: ExerciseKind, unit: Unit): string {
  if (kind === 'timed') return `${p.seconds ?? 0} s`;
  if (kind === 'bodyweight') return p.weightLb ? `+${formatWeight(p.weightLb, unit)} × ${p.reps ?? 0}` : `${p.reps ?? 0} reps`;
  return `${formatWeight(p.weightLb, unit)} × ${p.reps ?? 0}`;
}

/**
 * Whether a slot is folded when you haven't tapped it open or shut (W-17).
 * A finished exercise folds when the screen opens on it finished, or as soon
 * as a set is logged in another exercise. Rating its last set also folds it
 * (the screen does that). It doesn't fold the instant its last set is logged,
 * so the one-tap difficulty picker for that set stays in view (R-05.6).
 */
export function foldedByDefault(slotId: string, done: boolean, doneAtOpen: Set<string>, newestLogSlotId: string | null): boolean {
  if (!done) return false;
  if (doneAtOpen.has(slotId)) return true;
  return newestLogSlotId !== null && newestLogSlotId !== slotId;
}

/**
 * The one line a finished exercise folds to (W-17):
 * "Bench press · 3 sets · best 185 lb × 8". A set with a mid-set weight
 * change counts its best part.
 */
export function foldSummary(name: string, kind: ExerciseKind, logs: SetLog[], unit: Unit): string {
  const count = `${logs.length} ${logs.length === 1 ? 'set' : 'sets'}`;
  if (kind === 'activity') {
    const l = logs[0];
    const min = Math.round((l?.parts[0]?.seconds ?? 0) / 60);
    return `${name} · ${min} min${l?.distanceMi ? ` · ${formatDistance(l.distanceMi, unit)}` : ''}`;
  }
  let best: SetPart | null = null;
  for (const l of logs) {
    for (const p of l.parts) {
      if (!best || better(score(p, kind), score(best, kind))) best = p;
    }
  }
  return best ? `${name} · ${count} · best ${partText(best, kind, unit)}` : `${name} · ${count}`;
}
