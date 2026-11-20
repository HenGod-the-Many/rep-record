import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  BackupError,
  backupFileName,
  exportData,
  getLastBackup,
  markBackedUp,
  readBackup,
  restoreBackup,
  type BackupFile,
  type BackupSummary,
} from '../db/backup';

function formatDay(ms: number | string): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Hand the file to the iPhone share sheet; where files can't be shared, download it. Returns false if cancelled. */
async function saveFile(json: string, name: string): Promise<boolean> {
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      // Sharing failed for another reason: fall back to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** Settings section: Back up data, Restore from backup, Last backup (W-07). */
export function BackupSection() {
  const last = useLiveQuery(() => getLastBackup(db), []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; summary: BackupSummary } | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const backUp = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const file = await exportData(db);
      if (await saveFile(JSON.stringify(file), backupFileName())) {
        await markBackedUp(db);
        setMessage({ text: 'Backup saved.' });
      }
    } catch (e) {
      setMessage({ text: `Backup failed: ${String(e instanceof Error ? e.message : e)}`, error: true });
    } finally {
      setBusy(false);
    }
  };

  const picked = async (f: File | undefined) => {
    if (picker.current) picker.current.value = '';
    if (!f) return;
    setMessage(null);
    try {
      setPending(readBackup(await f.text(), db.verno));
    } catch (e) {
      setPending(null);
      setMessage({ text: e instanceof BackupError ? e.message : "This file can't be read.", error: true });
    }
  };

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(db, pending.backup);
      setMessage({ text: `Restored the backup from ${formatDay(pending.summary.exportedAt)}.` });
    } catch (e) {
      setMessage({ text: `Nothing was changed: the backup could not be restored (${String(e instanceof Error ? e.message : e)}).`, error: true });
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  const s = pending?.summary;
  return (
    <section className="stack" aria-label="Backup">
      <h2>Backup</h2>
      <p className="small-print muted">
        Your data is only on this phone. Save a backup to Files or iCloud Drive now and then.
      </p>
      <p>Last backup: {last === undefined ? '…' : last === null ? 'Never' : formatDay(last)}</p>
      <button className="btn-primary block" onClick={backUp} disabled={busy}>
        Back up data
      </button>
      <button className="btn-secondary block" onClick={() => picker.current?.click()} disabled={busy}>
        Restore from backup
      </button>
      <input
        ref={picker}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void picked(e.target.files?.[0])}
      />
      {s && (
        <div className="banner restore-confirm" role="alertdialog" aria-label="Confirm restore">
          <p>
            Backup from {formatDay(s.exportedAt)}: {s.exercises} exercises, {s.workouts} workouts, {s.sets} sets.
          </p>
          <p>
            <strong>This replaces all data on this phone.</strong>
          </p>
          <div className="button-row two">
            <button className="btn-danger" onClick={restore} disabled={busy}>
              Replace my data
            </button>
            <button className="btn-secondary" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className={message.error ? 'error' : 'small-print'} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
