import { useSyncExternalStore } from 'react';
import { db as appDb, type WorkoutDB } from './db/db';
import { restore, takeSnapshot, type Snapshot } from './db/reschedule';

export interface Pending {
  label: string;
  snapshot: Snapshot;
}

/**
 * Keeps the last calendar change so it can be undone right after. Undo puts
 * back schedules, date changes and splits as a whole, so any other change to
 * those tables made since (creating or editing a split, deleting a plan, …)
 * cancels the pending Undo instead of being silently thrown away by it.
 */
export class UndoManager {
  private pending: Pending | null = null;
  private busy = 0;
  private listeners = new Set<() => void>();

  constructor(private db: WorkoutDB) {
    const cancel = () => {
      if (this.busy === 0 && this.pending) {
        this.pending = null;
        this.emit();
      }
    };
    for (const table of [db.schedules, db.dateOverrides, db.splits, db.splitDays]) {
      table.hook('creating', cancel);
      table.hook('updating', cancel);
      table.hook('deleting', cancel);
    }
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  current = () => this.pending;

  /** Run a calendar change and remember how to put it back. */
  async run(label: string, change: () => Promise<unknown>): Promise<void> {
    this.busy++;
    try {
      const snapshot = await takeSnapshot(this.db);
      await change();
      this.pending = { label, snapshot };
    } finally {
      this.busy--;
    }
    this.emit();
  }

  async undo(): Promise<void> {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    this.emit();
    this.busy++;
    try {
      await restore(this.db, p.snapshot);
    } finally {
      this.busy--;
    }
  }

  dismiss() {
    this.pending = null;
    this.emit();
  }
}

const manager = new UndoManager(appDb);

export function usePendingUndo(): Pending | null {
  return useSyncExternalStore(manager.subscribe, manager.current);
}

export const withUndo = (label: string, change: () => Promise<unknown>) => manager.run(label, change);
export const undoLast = () => manager.undo();
export const dismissUndo = () => manager.dismiss();
