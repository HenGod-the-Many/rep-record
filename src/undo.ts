import { useSyncExternalStore } from 'react';
import { db } from './db/db';
import { restore, takeSnapshot, type Snapshot } from './db/reschedule';

/** The last calendar change, kept in memory so it can be undone right after. */
interface Pending {
  label: string;
  snapshot: Snapshot;
}

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePendingUndo(): Pending | null {
  return useSyncExternalStore(subscribe, () => pending);
}

/** Run a calendar change and remember how to put it back. */
export async function withUndo(label: string, change: () => Promise<unknown>): Promise<void> {
  const snapshot = await takeSnapshot(db);
  await change();
  pending = { label, snapshot };
  emit();
}

export async function undoLast(): Promise<void> {
  if (!pending) return;
  const snap = pending.snapshot;
  pending = null;
  emit();
  await restore(db, snap);
}

export function dismissUndo() {
  pending = null;
  emit();
}
