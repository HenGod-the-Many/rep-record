import Dexie from 'dexie';
import type { Metric, MetricEntry, Photo, WorkoutDB } from './db';
import { addDays } from './dates';
import { ValidationError } from './errors';
import { newId } from './ids';
import { LB_PER_KG, type Unit } from './units';
import { checkDate } from './schedule';

/**
 * Body metrics (W-11). Weight is stored in pounds and length in inches at full
 * precision; kg and cm exist only on screen. Body fat % and custom metrics are
 * stored as typed.
 */

export const CM_PER_IN = 2.54;

export async function listMetrics(db: WorkoutDB): Promise<Metric[]> {
  return db.metrics.orderBy('order').toArray();
}

/** Metrics shown on the Body screen: always-on ones and those switched on (photos are listed separately). */
export async function shownMetrics(db: WorkoutDB): Promise<Metric[]> {
  return (await listMetrics(db)).filter((m) => (m.alwaysOn || m.enabled) && m.kind !== 'photos');
}

export async function setMetricEnabled(db: WorkoutDB, id: string, enabled: boolean): Promise<void> {
  const m = await db.metrics.get(id);
  if (!m) throw new ValidationError('That metric no longer exists.');
  if (m.alwaysOn) throw new ValidationError(`${m.name} is always shown.`);
  await db.metrics.update(id, { enabled });
}

function cleanName(name: string): string {
  const n = name.trim();
  if (!n) throw new ValidationError('Give the metric a name.');
  return n;
}

async function checkUniqueName(db: WorkoutDB, name: string, exceptId?: string) {
  const clash = (await db.metrics.toArray()).find((m) => m.id !== exceptId && m.name.toLowerCase() === name.toLowerCase());
  if (clash) throw new ValidationError(`There is already a metric called ${clash.name}.`);
}

/** A metric Taylor names, e.g. "Resting HR" in "bpm". Switched on at once. */
export async function addCustomMetric(db: WorkoutDB, name: string, unit: string): Promise<string> {
  const n = cleanName(name);
  const u = unit.trim();
  if (!u) throw new ValidationError('Give the metric a unit, such as bpm.');
  return db.transaction('rw', db.metrics, async () => {
    await checkUniqueName(db, n);
    const last = await db.metrics.orderBy('order').last();
    const id = newId();
    await db.metrics.add({ id, name: n, kind: 'custom', unit: u, builtIn: false, alwaysOn: false, enabled: true, order: (last?.order ?? 0) + 1 });
    return id;
  });
}

export async function renameMetric(db: WorkoutDB, id: string, name: string, unit?: string): Promise<void> {
  const n = cleanName(name);
  await db.transaction('rw', db.metrics, async () => {
    const m = await db.metrics.get(id);
    if (!m) throw new ValidationError('That metric no longer exists.');
    if (m.builtIn) throw new ValidationError('Built-in metrics keep their names.');
    await checkUniqueName(db, n, id);
    await db.metrics.update(id, { name: n, ...(unit !== undefined && unit.trim() ? { unit: unit.trim() } : {}) });
  });
}

/** Custom metrics can be removed only while they hold no entries; otherwise switch them off. */
export async function deleteCustomMetric(db: WorkoutDB, id: string): Promise<void> {
  await db.transaction('rw', db.metrics, db.metricEntries, async () => {
    const m = await db.metrics.get(id);
    if (!m) return;
    if (m.builtIn) throw new ValidationError('Built-in metrics cannot be removed.');
    if ((await db.metricEntries.where('metricId').equals(id).count()) > 0) {
      throw new ValidationError(`${m.name} has entries, so it can only be switched off.`);
    }
    await db.metrics.delete(id);
  });
}

// ---------- entries ----------

function checkEntry(date: string, value: number) {
  checkDate(date);
  if (!Number.isFinite(value)) throw new ValidationError('Enter a number.');
  if (value < 0) throw new ValidationError('The value cannot be negative.');
}

export async function entryOn(db: WorkoutDB, metricId: string, date: string): Promise<MetricEntry | undefined> {
  return db.metricEntries.where('[metricId+date]').equals([metricId, date]).first();
}

/** Save a value for a date. One entry per metric per date: an existing one is replaced (the screen asks first). */
export async function saveEntry(db: WorkoutDB, metricId: string, date: string, value: number): Promise<string> {
  checkEntry(date, value);
  return db.transaction('rw', db.metrics, db.metricEntries, async () => {
    if (!(await db.metrics.get(metricId))) throw new ValidationError('That metric no longer exists.');
    const existing = await entryOn(db, metricId, date);
    if (existing) {
      await db.metricEntries.update(existing.id, { value });
      return existing.id;
    }
    const id = newId();
    await db.metricEntries.add({ id, metricId, date, value });
    return id;
  });
}

/** Change an entry's value or date. Moving it onto a date that already has one is refused. */
export async function updateEntry(db: WorkoutDB, id: string, date: string, value: number): Promise<void> {
  checkEntry(date, value);
  await db.transaction('rw', db.metricEntries, async () => {
    const e = await db.metricEntries.get(id);
    if (!e) throw new ValidationError('That entry no longer exists.');
    const other = await entryOn(db, e.metricId, date);
    if (other && other.id !== id) throw new ValidationError('There is already an entry on that date. Edit that one instead.');
    await db.metricEntries.update(id, { date, value });
  });
}

export async function deleteEntry(db: WorkoutDB, id: string): Promise<void> {
  await db.metricEntries.delete(id);
}

/** A metric's entries, newest first. */
export async function entriesFor(db: WorkoutDB, metricId: string): Promise<MetricEntry[]> {
  const rows = await db.metricEntries.where('metricId').equals(metricId).toArray();
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function latestEntry(db: WorkoutDB, metricId: string): Promise<MetricEntry | undefined> {
  return db.metricEntries.where('[metricId+date]').between([metricId, Dexie.minKey], [metricId, Dexie.maxKey]).last();
}

/** The latest bodyweight on or before a date, in pounds (used by W-15's calorie estimate). */
export async function bodyweightOn(db: WorkoutDB, date: string): Promise<number | null> {
  const e = (await entriesFor(db, 'bodyweight')).find((x) => x.date <= date);
  return e ? e.value : null;
}

/**
 * The 7-day rolling average (R-10.3): for each date that has an entry, the
 * mean of entries on that date and the 6 days before it. Dates without an
 * entry get no average, so a gap stays a gap. Oldest first.
 */
export function rollingAverage(entries: { date: string; value: number }[], days = 7): { date: string; value: number }[] {
  const asc = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  // Sliding window over the sorted entries: one pass.
  let start = 0;
  let sum = 0;
  return asc.map((e, i) => {
    sum += e.value;
    const from = addDays(e.date, -(days - 1));
    while (asc[start].date < from) sum -= asc[start++].value;
    return { date: e.date, value: sum / (i - start + 1) };
  });
}

// ---------- units ----------

/** Stored value -> the number shown. */
export function toShown(kind: Metric['kind'], stored: number, unit: Unit): number {
  if (kind === 'weight' && unit === 'kg') return stored / LB_PER_KG;
  if (kind === 'length' && unit === 'kg') return stored * CM_PER_IN;
  return stored;
}

/** A number typed on screen -> the stored value. */
export function fromShown(kind: Metric['kind'], shown: number, unit: Unit): number {
  if (kind === 'weight' && unit === 'kg') return shown * LB_PER_KG;
  if (kind === 'length' && unit === 'kg') return shown / CM_PER_IN;
  return shown;
}

/** The unit label for a metric: lb/kg, in/cm, %, or the custom unit. */
export function unitLabel(m: Pick<Metric, 'kind' | 'unit'>, unit: Unit): string {
  if (m.kind === 'weight') return unit;
  if (m.kind === 'length') return unit === 'kg' ? 'cm' : 'in';
  if (m.kind === 'percent') return '%';
  return m.unit;
}

const round = (v: number, places = 1) => String(Math.round(v * 10 ** places) / 10 ** places);

/** "182.4 lb", "5′ 10.5″", "178 cm", "18.5 %", "52 bpm". */
export function formatMetric(m: Pick<Metric, 'id' | 'kind' | 'unit'>, stored: number, unit: Unit): string {
  if (m.id === 'height' && unit === 'lb') {
    const ft = Math.floor(stored / 12 + 1e-9);
    return `${ft}′ ${round(stored - ft * 12)}″`;
  }
  return `${round(toShown(m.kind, stored, unit))} ${unitLabel(m, unit)}`;
}

/**
 * Text typed into a value box -> the stored value. Keeps the stored value
 * unchanged when the text is exactly what is already shown for it, so editing
 * nothing never rounds it.
 */
export function parseShown(kind: Metric['kind'], text: string, unit: Unit, current: number | null): number {
  const t = text.trim().replace(',', '.');
  const v = Number(t);
  if (t === '' || !Number.isFinite(v)) throw new ValidationError('Enter a number.');
  if (current !== null && round(toShown(kind, current, unit)) === String(v)) return current;
  return fromShown(kind, v, unit);
}

// ---------- photos ----------

export async function addPhoto(db: WorkoutDB, date: string, image: Blob, width: number, height: number, now = Date.now()): Promise<string> {
  checkDate(date);
  const id = newId();
  await db.photos.add({ id, date, image, width, height, bytes: image.size, addedAt: now });
  return id;
}

/** Newest first (by date, then the order they were added). */
export async function listPhotos(db: WorkoutDB): Promise<Photo[]> {
  const rows = await db.photos.toArray();
  return rows.sort((a, b) => (a.date === b.date ? b.addedAt - a.addedAt : a.date < b.date ? 1 : -1));
}

export async function deletePhoto(db: WorkoutDB, id: string): Promise<void> {
  await db.photos.delete(id);
}
