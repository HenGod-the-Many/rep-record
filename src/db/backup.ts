import Dexie from 'dexie';
import { WorkoutDB } from './db';
import { newId } from './ids';

/**
 * Backup files (W-07, decision 0004). One JSON file holds every table, read
 * from the database itself so tables added later are included automatically.
 * Restore checks the whole file first and then replaces all data in one
 * transaction: either everything is replaced or nothing changes.
 */

export const BACKUP_APP = 'rep-record';
/** Setting that records when this phone last made a backup. Restore keeps the phone's own value. */
export const LAST_BACKUP_KEY = 'lastBackupAt';

export interface BackupFile {
  app: typeof BACKUP_APP;
  dataVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

export interface BackupSummary {
  exportedAt: string;
  dataVersion: number;
  exercises: number;
  workouts: number;
  sets: number;
}

/** A file that can't be restored. `message` is written for Taylor. */
export class BackupError extends Error {}

// ---------- binary values (photos from W-11) ----------

const BLOB_TAG = '__repRecordBlob';

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Blobs become `{ __repRecordBlob: base64, type }`; everything else is copied as is. */
export async function encodeValue(v: unknown): Promise<unknown> {
  if (typeof Blob !== 'undefined' && v instanceof Blob) {
    return { [BLOB_TAG]: bytesToBase64(new Uint8Array(await v.arrayBuffer())), type: v.type };
  }
  if (Array.isArray(v)) return Promise.all(v.map(encodeValue));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = await encodeValue(x);
    return out;
  }
  return v;
}

export function decodeValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(decodeValue);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o[BLOB_TAG] === 'string') {
      return new Blob([base64ToBytes(o[BLOB_TAG] as string) as BlobPart], { type: String(o.type ?? '') });
    }
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = decodeValue(x);
    return out;
  }
  return v;
}

// ---------- export ----------

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `rep-record-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** Every table, every row. Does not record a backup: call `markBackedUp` once the file is saved. */
function hasBlob(v: unknown): boolean {
  if (typeof Blob !== 'undefined' && v instanceof Blob) return true;
  if (Array.isArray(v)) return v.some(hasBlob);
  if (v && typeof v === 'object') return Object.values(v).some(hasBlob);
  return false;
}

export async function exportData(db: WorkoutDB, now = new Date()): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  await db.transaction('r', db.tables, async () => {
    for (const t of db.tables) tables[t.name] = await t.toArray();
  });
  // Only rows holding binary values need the (async) encoding; the rest are copied as they are.
  for (const name of Object.keys(tables)) {
    tables[name] = await Promise.all(tables[name].map((row) => (hasBlob(row) ? encodeValue(row) : row)));
  }
  return { app: BACKUP_APP, dataVersion: db.verno, exportedAt: now.toISOString(), tables };
}

/**
 * The backup file's text as a list of pieces (one per row), so a backup with
 * many photos is never one giant string in memory. Joined, the pieces are
 * exactly JSON.stringify(file).
 */
export function backupParts(file: BackupFile): string[] {
  const parts: string[] = [`{"app":${JSON.stringify(file.app)},"dataVersion":${file.dataVersion},"exportedAt":${JSON.stringify(file.exportedAt)},"tables":{`];
  Object.entries(file.tables).forEach(([name, rows], t) => {
    parts.push(`${t ? ',' : ''}${JSON.stringify(name)}:[`);
    rows.forEach((row, i) => parts.push((i ? ',' : '') + JSON.stringify(row)));
    parts.push(']');
  });
  parts.push('}}');
  return parts;
}

export async function markBackedUp(db: WorkoutDB, at = Date.now()): Promise<void> {
  await db.settings.put({ key: LAST_BACKUP_KEY, value: at });
}

export async function getLastBackup(db: WorkoutDB): Promise<number | null> {
  const s = await db.settings.get(LAST_BACKUP_KEY);
  return typeof s?.value === 'number' ? s.value : null;
}

/** True when Today should remind: at least one workout logged and no backup in the last 7 days. */
export async function backupOverdue(db: WorkoutDB, now = Date.now()): Promise<boolean> {
  if ((await db.setLogs.count()) === 0) return false;
  const last = await getLastBackup(db);
  return last === null || now - last > 7 * 24 * 60 * 60 * 1000;
}

// ---------- reading and checking a file ----------

function keyPaths(spec: { keyPath?: string | string[] | null }): string[] {
  const k = spec.keyPath;
  if (!k) return [];
  return Array.isArray(k) ? k : [k];
}

/** Parse and check a backup file's text. Throws BackupError with a plain message; changes nothing. */
export function readBackup(text: string, currentVersion: number): { backup: BackupFile; summary: BackupSummary } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("This file can't be read. It isn't a Rep Record backup, or it is damaged.");
  }
  const f = data as Partial<BackupFile> | null;
  if (!f || typeof f !== 'object' || f.app !== BACKUP_APP) {
    throw new BackupError('This file is not a Rep Record backup.');
  }
  if (typeof f.dataVersion !== 'number' || !Number.isInteger(f.dataVersion) || f.dataVersion < 1) {
    throw new BackupError('This backup is damaged: its version is missing.');
  }
  if (f.dataVersion > currentVersion) {
    throw new BackupError('This backup was made by a newer version of Rep Record. Update the app first (close it fully and reopen), then try again.');
  }
  if (typeof f.exportedAt !== 'string' || Number.isNaN(Date.parse(f.exportedAt))) {
    throw new BackupError('This backup is damaged: its date is missing.');
  }
  if (!f.tables || typeof f.tables !== 'object') throw new BackupError('This backup is damaged: it has no data.');

  // The tables and keys that a database of the backup's own version has.
  const schema = new WorkoutDB('__backup-schema__', f.dataVersion);
  const sameVersion = f.dataVersion === currentVersion;
  for (const t of schema.tables) {
    const rows = f.tables[t.name];
    if (!Array.isArray(rows)) throw new BackupError(`This backup is damaged: the ${t.name} list is missing.`);
    // Rows must carry their key; a backup of the current version must also carry every indexed field.
    const required = keyPaths(t.schema.primKey);
    if (sameVersion) for (const ix of t.schema.indexes) required.push(...keyPaths(ix));
    rows.forEach((row, i) => {
      if (!row || typeof row !== 'object') throw new BackupError(`This backup is damaged: entry ${i + 1} in ${t.name} is unreadable.`);
      for (const field of required) {
        if (!(field in row)) throw new BackupError(`This backup is damaged: entry ${i + 1} in ${t.name} has no ${field}.`);
      }
    });
  }
  const backup = f as BackupFile;
  const tables = backup.tables;
  return {
    backup,
    summary: {
      exportedAt: backup.exportedAt,
      dataVersion: backup.dataVersion,
      exercises: tables.exercises?.length ?? 0,
      workouts: tables.sessions?.length ?? 0,
      sets: tables.setLogs?.length ?? 0,
    },
  };
}

// ---------- restore ----------

/**
 * Bring an older backup up to the current shape by loading it into a
 * temporary database of its own version and opening that with the app's
 * full schema, so the app's own upgrade steps run on it.
 */
async function upgradeTables(backup: BackupFile): Promise<Record<string, unknown[]>> {
  const name = `rep-record-restore-${newId()}`;
  const old = new WorkoutDB(name, backup.dataVersion);
  const now = new WorkoutDB(name);
  try {
    await old.open();
    await old.transaction('rw', old.tables, async () => {
      for (const t of old.tables) await t.bulkPut(decodeValue(backup.tables[t.name]) as never[]);
    });
    old.close();
    await now.open();
    const out: Record<string, unknown[]> = {};
    for (const t of now.tables) out[t.name] = await t.toArray();
    now.close();
    return out;
  } finally {
    old.close();
    now.close();
    await Dexie.delete(name);
  }
}

/** Replace all data with the backup's. All or nothing; the phone's last-backup date is kept. */
export async function restoreBackup(db: WorkoutDB, backup: BackupFile): Promise<void> {
  const tables =
    backup.dataVersion === db.verno
      ? (Object.fromEntries(db.tables.map((t) => [t.name, decodeValue(backup.tables[t.name] ?? [])])) as Record<string, unknown[]>)
      : await upgradeTables(backup);
  await db.transaction('rw', db.tables, async () => {
    const kept = await db.settings.get(LAST_BACKUP_KEY);
    for (const t of db.tables) {
      await t.clear();
      await t.bulkAdd((tables[t.name] ?? []) as never[]);
    }
    await db.settings.delete(LAST_BACKUP_KEY);
    if (kept) await db.settings.put(kept);
  });
}
