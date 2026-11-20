import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import {
  BackupError,
  LAST_BACKUP_KEY,
  backupFileName,
  backupOverdue,
  decodeValue,
  encodeValue,
  exportData,
  getLastBackup,
  markBackedUp,
  readBackup,
  restoreBackup,
} from './backup';
import type { WorkoutDB } from './db';
import { finishSession, logSet, startOrResume } from './logging';
import { exerciseId, freshDb, planId } from '../test/helpers';

/** Every row of every table, for before/after comparisons. */
async function snapshot(db: WorkoutDB): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of db.tables) out[t.name] = await t.toArray();
  return out;
}

/** A database with a finished workout, an open one, kg weights at full precision and a day note. */
async function withData(): Promise<WorkoutDB> {
  const db = await freshDb();
  const push = await planId(db, 'Push');
  const bench = await exerciseId(db, 'Bench press');
  const s1 = await startOrResume(db, { date: '2026-11-17', planId: push, time: 'morning' });
  await logSet(db, { sessionId: s1, exerciseId: bench, planExerciseId: null, setNumber: 1, parts: [{ weightLb: 61.23 * 2.20462262185, reps: 8, seconds: null }] });
  await logSet(db, { sessionId: s1, exerciseId: bench, planExerciseId: null, setNumber: 2, parts: [{ weightLb: 135, reps: 5, seconds: null }, { weightLb: 115, reps: 3, seconds: null }] });
  await finishSession(db, s1);
  await startOrResume(db, { date: '2026-11-20', planId: push, time: 'evening' });
  await db.dayNotes.put({ date: '2026-11-20', energy: 4, sleep: 3, soreness: null, note: 'tired' });
  return db;
}

const text = (o: unknown) => JSON.stringify(o);

describe('backup export', () => {
  it('writes every table in the database, with app name, version and time', async () => {
    const db = await withData();
    const file = await exportData(db, new Date('2026-11-20T10:00:00Z'));
    expect(file.app).toBe('rep-record');
    expect(file.dataVersion).toBe(db.verno);
    expect(file.exportedAt).toBe('2026-11-20T10:00:00.000Z');
    expect(Object.keys(file.tables).sort()).toEqual(db.tables.map((t) => t.name).sort());
    expect(file.tables.setLogs).toHaveLength(2);
  });

  it('names the file by date', () => {
    expect(backupFileName(new Date(2026, 10, 5))).toBe('rep-record-backup-2026-11-05.json');
  });

  it('writes binary values as text and reads them back byte for byte', async () => {
    const bytes = new Uint8Array(70000).map((_, i) => (i * 7) % 256);
    const encoded = await encodeValue({ id: 'p', image: new Blob([bytes], { type: 'image/jpeg' }) });
    const back = decodeValue(JSON.parse(JSON.stringify(encoded))) as { image: Blob };
    expect(back.image.type).toBe('image/jpeg');
    expect(new Uint8Array(await back.image.arrayBuffer())).toEqual(bytes);
  });
});

describe('backup round trip', () => {
  it('export, wipe, restore: every row of every table is back exactly', async () => {
    const db = await withData();
    const before = await snapshot(db);
    const file = text(await exportData(db));

    const empty = await freshDb({ seed: false });
    const { backup } = readBackup(file, empty.verno);
    await restoreBackup(empty, backup);
    expect(await snapshot(empty)).toEqual(before);
    // Full precision and open/finished sessions survive.
    const sets = await empty.setLogs.toArray();
    expect(sets.some((s) => s.parts[0].weightLb === 61.23 * 2.20462262185)).toBe(true);
    expect((await empty.sessions.toArray()).map((s) => s.finishedAt === null).sort()).toEqual([false, true]);
  });

  it('replaces everything already on the phone', async () => {
    const db = await withData();
    const file = text(await exportData(db));
    const bench = await exerciseId(db, 'Bench press');
    const s = await startOrResume(db, { date: '2026-11-21', planId: await planId(db, 'Push'), time: 'morning' });
    await logSet(db, { sessionId: s, exerciseId: bench, planExerciseId: null, setNumber: 1, parts: [{ weightLb: 200, reps: 1, seconds: null }] });
    expect(await db.setLogs.count()).toBe(3);
    await restoreBackup(db, readBackup(file, db.verno).backup);
    expect(await db.setLogs.count()).toBe(2);
    expect(await db.sessions.where('date').equals('2026-11-21').count()).toBe(0);
  });

  it("keeps the phone's own last-backup date, not the file's", async () => {
    const db = await withData();
    await markBackedUp(db, 1000);
    const file = text(await exportData(db));
    await markBackedUp(db, 5000);
    await restoreBackup(db, readBackup(file, db.verno).backup);
    expect(await getLastBackup(db)).toBe(5000);

    const fresh = await freshDb({ seed: false });
    await restoreBackup(fresh, readBackup(file, fresh.verno).backup);
    expect(await fresh.settings.get(LAST_BACKUP_KEY)).toBeUndefined();
  });

  it('summarises the file before restoring', async () => {
    const db = await withData();
    const { summary } = readBackup(text(await exportData(db, new Date('2026-11-20T10:00:00Z'))), db.verno);
    expect(summary).toEqual({ exportedAt: '2026-11-20T10:00:00.000Z', dataVersion: db.verno, exercises: 37, workouts: 2, sets: 2 });
  });
});

describe('damaged or wrong files are refused and change nothing (R-08.4)', () => {
  async function refused(make: (good: Record<string, any>) => string, message: RegExp) {
    const db = await withData();
    const good = JSON.parse(text(await exportData(db)));
    const before = await snapshot(db);
    let err: unknown;
    try {
      const { backup } = readBackup(make(good), db.verno);
      await restoreBackup(db, backup);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).toMatch(message);
    expect(await snapshot(db)).toEqual(before);
  }

  it('not JSON', () => refused(() => 'hello, not json {', /can't be read/));
  it('a photo or other binary file', () => refused(() => 'ÿØÿàJFIF', /can't be read/));
  it('JSON from something else', () => refused(() => text({ name: 'my playlist', songs: [] }), /not a Rep Record backup/));
  it('a backup from a newer app', () => refused((g) => text({ ...g, dataVersion: g.dataVersion + 1 }), /newer version/));
  it('a missing or broken date', () => refused((g) => text({ ...g, exportedAt: 'soon' }), /date is missing/));
  it('a missing table', () =>
    refused((g) => {
      delete g.tables.setLogs;
      return text(g);
    }, /setLogs list is missing/));
  it('a row missing its key', () =>
    refused((g) => {
      delete g.tables.exercises[3].id;
      return text(g);
    }, /entry 4 in exercises has no id/));
  it('a row missing an indexed field', () =>
    refused((g) => {
      delete g.tables.setLogs[0].exerciseId;
      return text(g);
    }, /entry 1 in setLogs has no exerciseId/));
  it('a failure half-way through restoring leaves the old data (two rows with one key)', () =>
    refused((g) => {
      g.tables.setLogs.push({ ...g.tables.setLogs[0] });
      return text(g);
    }, /./));
  it('all damage is a BackupError until the restore step', () => {
    expect(() => readBackup('nope', 3)).toThrow(BackupError);
  });
});

describe('older backups', () => {
  it('a version-2 backup is brought up to the current shape by the app’s own upgrade steps', async () => {
    const empty = (name: string) => ({
      exercises: [{ id: 'bench', name: 'Bench press', muscleGroup: 'Chest', kind: 'weight', notes: '', archived: false }],
      plans: [], planExercises: [], splits: [], splitDays: [], schedules: [], dateOverrides: [],
      sessions: [{ id: 's', date: '2026-11-10', planId: null, planName: name, splitId: null, journalNote: '' }],
      setLogs: [{ id: 'l', sessionId: 's', exerciseId: 'bench', planExerciseId: null, setNumber: 1, weightLb: 135, reps: 8, seconds: null, note: '', loggedAt: 1 }],
      dayNotes: [], settings: [{ key: 'seeded', value: true }],
    });
    const file = text({ app: 'rep-record', dataVersion: 2, exportedAt: '2026-11-10T00:00:00Z', tables: empty('Old') });
    const db = await freshDb({ seed: false });
    await restoreBackup(db, readBackup(file, db.verno).backup);
    const set = await db.setLogs.get('l');
    expect(set?.parts).toEqual([{ weightLb: 135, reps: 8, seconds: null }]);
    expect(set?.difficulty).toBeNull();
    expect((await db.sessions.get('s'))?.finishedAt).toBe(0);
    // The temporary database is gone.
    expect((await Dexie.getDatabaseNames()).filter((n) => n.startsWith('rep-record-restore-'))).toEqual([]);
  });
});

describe('backup reminder', () => {
  it('only once a workout is logged, then when the last backup is over 7 days old', async () => {
    const day = 24 * 60 * 60 * 1000;
    const db = await freshDb();
    expect(await backupOverdue(db)).toBe(false);
    const s = await startOrResume(db, { date: '2026-11-20', planId: await planId(db, 'Push'), time: 'morning' });
    await logSet(db, { sessionId: s, exerciseId: await exerciseId(db, 'Bench press'), planExerciseId: null, setNumber: 1, parts: [{ weightLb: 135, reps: 5, seconds: null }] });
    expect(await backupOverdue(db)).toBe(true);
    await markBackedUp(db, 10 * day);
    expect(await backupOverdue(db, 16 * day)).toBe(false);
    expect(await backupOverdue(db, 17 * day + 1)).toBe(true);
  });
});
