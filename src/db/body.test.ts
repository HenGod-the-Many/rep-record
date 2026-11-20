import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import {
  addCustomMetric,
  addPhoto,
  bodyweightOn,
  deleteCustomMetric,
  deleteEntry,
  entriesFor,
  entryOn,
  formatMetric,
  listMetrics,
  listPhotos,
  parseShown,
  renameMetric,
  rollingAverage,
  saveEntry,
  setMetricEnabled,
  shownMetrics,
  toShown,
  updateEntry,
} from './body';
import { exportData, readBackup, restoreBackup } from './backup';
import { WorkoutDB } from './db';
import { freshDb } from '../test/helpers';

describe('built-in metrics', () => {
  it('a brand-new database has bodyweight and height on, and the optional ones off', async () => {
    const db = await freshDb();
    const ms = await listMetrics(db);
    expect(ms.map((m) => m.name)).toEqual(['Bodyweight', 'Height', 'Waist', 'Chest', 'Hips', 'Upper arm', 'Thigh', 'Neck', 'Calf', 'Body fat', 'Progress photos']);
    expect(ms.filter((m) => m.enabled).map((m) => m.id)).toEqual(['bodyweight', 'height']);
    expect((await shownMetrics(db)).map((m) => m.id)).toEqual(['bodyweight', 'height']);
  });

  it('existing data from version 3 gets them through the upgrade', async () => {
    const name = `v3-${Date.now()}`;
    const old = new WorkoutDB(name, 3);
    await old.open();
    await old.settings.put({ key: 'seeded', value: true });
    old.close();
    const db = new WorkoutDB(name);
    await db.open();
    expect((await listMetrics(db)).length).toBe(11);
    db.close();
    await Dexie.delete(name);
  });

  it('bodyweight and height cannot be switched off', async () => {
    const db = await freshDb();
    await expect(setMetricEnabled(db, 'bodyweight', false)).rejects.toThrow('always shown');
  });
});

describe('bodyweight entries (R-10.1)', () => {
  it('any dates with gaps; one per date, a second replaces the first; edit and delete', async () => {
    const db = await freshDb();
    await saveEntry(db, 'bodyweight', '2026-11-01', 182.4);
    await saveEntry(db, 'bodyweight', '2026-11-05', 181);
    const replaced = await saveEntry(db, 'bodyweight', '2026-11-05', 180.6);
    expect((await entriesFor(db, 'bodyweight')).map((e) => [e.date, e.value])).toEqual([['2026-11-05', 180.6], ['2026-11-01', 182.4]]);
    expect((await entryOn(db, 'bodyweight', '2026-11-05'))?.id).toBe(replaced);

    await updateEntry(db, replaced, '2026-11-06', 180.2);
    expect((await entriesFor(db, 'bodyweight'))[0]).toMatchObject({ date: '2026-11-06', value: 180.2 });
    const first = (await entryOn(db, 'bodyweight', '2026-11-01'))!.id;
    await expect(updateEntry(db, first, '2026-11-06', 1)).rejects.toThrow('already an entry');
    await deleteEntry(db, first);
    expect(await entriesFor(db, 'bodyweight')).toHaveLength(1);
  });

  it('refuses a bad date, a negative or missing number', async () => {
    const db = await freshDb();
    await expect(saveEntry(db, 'bodyweight', '2026-02-30', 180)).rejects.toThrow('date');
    await expect(saveEntry(db, 'bodyweight', '2026-11-01', -1)).rejects.toThrow('negative');
    await expect(saveEntry(db, 'bodyweight', '2026-11-01', NaN)).rejects.toThrow('number');
  });

  it('the bodyweight on or before a date', async () => {
    const db = await freshDb();
    await saveEntry(db, 'bodyweight', '2026-11-01', 182);
    await saveEntry(db, 'bodyweight', '2026-11-10', 179);
    expect(await bodyweightOn(db, '2026-10-31')).toBeNull();
    expect(await bodyweightOn(db, '2026-11-05')).toBe(182);
    expect(await bodyweightOn(db, '2026-11-10')).toBe(179);
  });
});

describe('height (R-10.2)', () => {
  it('the latest entry is the current height; older values stay in its history', async () => {
    const db = await freshDb();
    await saveEntry(db, 'height', '2025-01-01', 70);
    await saveEntry(db, 'height', '2026-11-01', 70.5);
    const h = await entriesFor(db, 'height');
    expect(h[0].value).toBe(70.5);
    expect(h).toHaveLength(2);
    expect(formatMetric({ id: 'height', kind: 'length', unit: '' }, 70.5, 'lb')).toBe('5′ 10.5″');
    expect(formatMetric({ id: 'height', kind: 'length', unit: '' }, 70.5, 'kg')).toBe('179.1 cm');
  });
});

describe('7-day rolling average (R-10.3)', () => {
  it('uses only entries on that date and the 6 days before, and only on dates with an entry', () => {
    const avg = rollingAverage([
      { date: '2026-11-10', value: 179 },
      { date: '2026-11-01', value: 180 },
      { date: '2026-11-03', value: 182 },
    ]);
    expect(avg).toEqual([
      { date: '2026-11-01', value: 180 },
      { date: '2026-11-03', value: 181 },
      { date: '2026-11-10', value: 179 },
    ]);
  });

  it('the window is exactly 7 days: the 7th day back is out', () => {
    const avg = rollingAverage([
      { date: '2026-11-01', value: 100 },
      { date: '2026-11-07', value: 200 },
      { date: '2026-11-08', value: 300 },
    ]);
    expect(avg.map((a) => a.value)).toEqual([100, 150, 250]);
  });
});

describe('optional and custom metrics (R-10.4, R-10.5)', () => {
  it('switching off hides a metric and keeps its entries', async () => {
    const db = await freshDb();
    await setMetricEnabled(db, 'waist', true);
    await saveEntry(db, 'waist', '2026-11-20', 33);
    expect((await shownMetrics(db)).map((m) => m.id)).toContain('waist');
    await setMetricEnabled(db, 'waist', false);
    expect((await shownMetrics(db)).map((m) => m.id)).not.toContain('waist');
    expect(await entriesFor(db, 'waist')).toHaveLength(1);
    await setMetricEnabled(db, 'waist', true);
    expect((await entriesFor(db, 'waist'))[0].value).toBe(33);
  });

  it('custom metrics: named with a unit, renamed, unique names, removed only when empty', async () => {
    const db = await freshDb();
    const hr = await addCustomMetric(db, ' Resting HR ', 'bpm');
    expect((await shownMetrics(db)).find((m) => m.id === hr)).toMatchObject({ name: 'Resting HR', unit: 'bpm', kind: 'custom' });
    await expect(addCustomMetric(db, 'resting hr', 'bpm')).rejects.toThrow('already');
    await expect(addCustomMetric(db, 'Waist', 'in')).rejects.toThrow('already');
    await expect(addCustomMetric(db, '', 'bpm')).rejects.toThrow('name');
    await expect(addCustomMetric(db, 'VO2', ' ')).rejects.toThrow('unit');
    await renameMetric(db, hr, 'Morning HR');
    expect((await db.metrics.get(hr))?.name).toBe('Morning HR');
    await expect(renameMetric(db, 'waist', 'Belly')).rejects.toThrow('keep their names');
    await saveEntry(db, hr, '2026-11-20', 52);
    await expect(deleteCustomMetric(db, hr)).rejects.toThrow('switched off');
    const empty = await addCustomMetric(db, 'Grip', 'kg');
    await deleteCustomMetric(db, empty);
    expect(await db.metrics.get(empty)).toBeUndefined();
  });
});

describe('units (R-10.7)', () => {
  it('weight in lb and length in inches, shown as kg and cm; switching changes nothing stored', async () => {
    const db = await freshDb();
    await saveEntry(db, 'bodyweight', '2026-11-20', 182.4);
    await saveEntry(db, 'waist', '2026-11-20', 33);
    expect(formatMetric({ id: 'bodyweight', kind: 'weight', unit: '' }, 182.4, 'kg')).toBe('82.7 kg');
    expect(formatMetric({ id: 'waist', kind: 'length', unit: '' }, 33, 'kg')).toBe('83.8 cm');
    expect(formatMetric({ id: 'body-fat', kind: 'percent', unit: '' }, 18.5, 'kg')).toBe('18.5 %');
    expect((await entryOn(db, 'bodyweight', '2026-11-20'))?.value).toBe(182.4);
  });

  it('a value typed in kg or cm reads back the same; typing what is shown keeps the stored value', () => {
    const lb = parseShown('weight', '82.5', 'kg', null);
    expect(Math.round(toShown('weight', lb, 'kg') * 1000) / 1000).toBe(82.5);
    expect(parseShown('weight', '82.7', 'kg', 182.4)).toBe(182.4);
    const inches = parseShown('length', '84', 'kg', null);
    expect(inches).toBeCloseTo(33.0709, 3);
    expect(() => parseShown('weight', 'abc', 'lb', null)).toThrow('number');
  });
});

describe('photos (R-10.6)', () => {
  it('stored on the phone by date, newest first, and deleted', async () => {
    const db = await freshDb();
    const a = await addPhoto(db, '2026-11-01', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), 1200, 1600, 1);
    const b = await addPhoto(db, '2026-11-20', new Blob([new Uint8Array([4, 5])], { type: 'image/jpeg' }), 1200, 1600, 2);
    expect((await listPhotos(db)).map((p) => p.id)).toEqual([b, a]);
    expect((await db.photos.get(a))?.bytes).toBe(3);
  });

  it('go into the backup and come back byte for byte', async () => {
    const db = await freshDb();
    const bytes = new Uint8Array(5000).map((_, i) => (i * 13) % 256);
    await addPhoto(db, '2026-11-20', new Blob([bytes], { type: 'image/jpeg' }), 1200, 1600);
    await saveEntry(db, 'bodyweight', '2026-11-20', 182.4);
    const file = JSON.stringify(await exportData(db));
    const other = await freshDb({ seed: false });
    await restoreBackup(other, readBackup(file, other.verno).backup);
    const [p] = await listPhotos(other);
    expect(p.image.type).toBe('image/jpeg');
    expect(new Uint8Array(await p.image.arrayBuffer())).toEqual(bytes);
    expect((await entryOn(other, 'bodyweight', '2026-11-20'))?.value).toBe(182.4);
  });
});
