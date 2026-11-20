import type { WorkoutDB } from './db';

/**
 * Weights are always stored in pounds at full precision. Kilograms exist only
 * on screen: a value is converted for display and converted back on entry, and
 * the stored pounds are never rounded.
 */
export type Unit = 'lb' | 'kg';

export const LB_PER_KG = 2.20462262185;

/** The ± step and the rounding step for quick drops, in the display unit. */
export const WEIGHT_STEP: Record<Unit, number> = { lb: 5, kg: 2.5 };

export async function getUnit(db: WorkoutDB): Promise<Unit> {
  const s = await db.settings.get('unit');
  return s?.value === 'kg' ? 'kg' : 'lb';
}

export async function setUnit(db: WorkoutDB, unit: Unit): Promise<void> {
  await db.settings.put({ key: 'unit', value: unit });
}

/** Pounds -> the number shown in the display unit (unrounded). */
export function toDisplay(lb: number, unit: Unit): number {
  return unit === 'kg' ? lb / LB_PER_KG : lb;
}

/** A number typed in the display unit -> pounds (unrounded). */
export function fromDisplay(value: number, unit: Unit): number {
  return unit === 'kg' ? value * LB_PER_KG : value;
}

/** The display number as text: at most 2 decimals, trailing zeros dropped. "135", "61.23", "60". */
export function displayNumber(lb: number, unit: Unit): string {
  const v = Math.round(toDisplay(lb, unit) * 100) / 100;
  return String(v);
}

/** "135 lb", "61.23 kg". */
export function formatWeight(lb: number | null, unit: Unit): string {
  return lb === null ? '' : `${displayNumber(lb, unit)} ${unit}`;
}

/**
 * One ± step (5 lb or 2.5 kg) in the display unit, landing on that step's grid:
 * 61.23 kg + goes to 62.5, 135 lb + goes to 140. Never below 0.
 */
export function stepWeight(lb: number | null, direction: 1 | -1, unit: Unit): number {
  const step = WEIGHT_STEP[unit];
  const shown = lb === null ? 0 : toDisplay(lb, unit);
  const eps = 1e-6;
  const next = direction > 0 ? (Math.floor(shown / step + eps) + 1) * step : (Math.ceil(shown / step - eps) - 1) * step;
  return Math.max(0, fromDisplay(next, unit));
}

/** A quick drop of pct % (10, 20, 30), rounded to the nearest 5 lb or 2.5 kg in the display unit. */
export function quickDrop(lb: number, pct: number, unit: Unit): number {
  const step = WEIGHT_STEP[unit];
  const shown = toDisplay(lb, unit) * (1 - pct / 100);
  return fromDisplay(Math.max(0, Math.round(shown / step) * step), unit);
}

/**
 * Text typed into a weight box -> pounds. If the text is exactly what is
 * already shown for `currentLb`, the stored value is kept as it is, so typing
 * nothing new never rounds a stored weight.
 */
export function parseWeight(text: string, unit: Unit, currentLb: number | null): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const v = Number(t);
  if (!Number.isFinite(v) || v < 0) return currentLb;
  if (currentLb !== null && displayNumber(currentLb, unit) === String(v)) return currentLb;
  return fromDisplay(v, unit);
}
