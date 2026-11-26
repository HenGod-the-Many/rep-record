import type { GroupKind, PlanExercise, WorkoutDB } from './db';
import { ValidationError } from './errors';
import { newId } from './ids';
import { getEntries, NO_GROUP } from './plans';

/*
 * Supersets and circuits in plans (W-19, decision 0007). A group lives on its
 * member entries: a shared key, the kind and the rounds. Members are
 * consecutive in the plan and each does every round.
 */

export type PlanBlock =
  | { type: 'single'; entry: PlanExercise }
  | { type: 'group'; key: string; kind: GroupKind; rounds: number; entries: PlanExercise[] };

/** A plan's entries (in order) as blocks: consecutive entries with one key form a group. */
export function planBlocks(entries: PlanExercise[]): PlanBlock[] {
  const blocks: PlanBlock[] = [];
  for (const e of entries) {
    const last = blocks[blocks.length - 1];
    if (e.groupKey && last?.type === 'group' && last.key === e.groupKey) last.entries.push(e);
    else if (e.groupKey) blocks.push({ type: 'group', key: e.groupKey, kind: e.groupKind ?? 'superset', rounds: e.groupRounds ?? e.targetSets, entries: [e] });
    else blocks.push({ type: 'single', entry: e });
  }
  // A "group" of one (a broken group) shows as a single entry.
  return blocks.map((b) => (b.type === 'group' && b.entries.length < 2 ? { type: 'single', entry: b.entries[0] } : b));
}

/** "Superset" or "Circuit". */
export const groupLabel = (kind: GroupKind) => (kind === 'circuit' ? 'Circuit' : 'Superset');

function checkRounds(rounds: number): void {
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) throw new ValidationError('Rounds must be a whole number from 1 to 20.');
}

/** Group two or more entries that are next to each other. Returns the group's key. */
export async function makeGroup(db: WorkoutDB, planId: string, entryIds: string[], kind: GroupKind, rounds: number): Promise<string> {
  checkRounds(rounds);
  if (new Set(entryIds).size < 2) throw new ValidationError('Pick at least two exercises for a superset or circuit.');
  return db.transaction('rw', db.planExercises, async () => {
    const entries = await getEntries(db, planId);
    const at = entryIds.map((id) => entries.findIndex((e) => e.id === id)).sort((a, b) => a - b);
    if (at.some((i) => i < 0)) throw new ValidationError('That exercise is no longer in the workout.');
    if (at.some((i, n) => n > 0 && i !== at[n - 1] + 1)) throw new ValidationError('Pick exercises that are in a row in the workout.');
    if (at.some((i) => entries[i].groupKey)) throw new ValidationError('One of those exercises is already in a superset or circuit.');
    const key = newId();
    for (const i of at) {
      await db.planExercises.update(entries[i].id, { groupKey: key, groupKind: kind, groupRounds: rounds, targetSets: rounds });
    }
    return key;
  });
}

/** Change a group's kind and rounds; every member follows. */
export async function setGroup(db: WorkoutDB, planId: string, key: string, kind: GroupKind, rounds: number): Promise<void> {
  checkRounds(rounds);
  await db.transaction('rw', db.planExercises, async () => {
    const members = (await getEntries(db, planId)).filter((e) => e.groupKey === key);
    if (members.length === 0) throw new ValidationError('That superset or circuit no longer exists.');
    for (const e of members) await db.planExercises.update(e.id, { groupKind: kind, groupRounds: rounds, targetSets: rounds });
  });
}

/** Undo a group: its exercises stay where they are, with their current sets. */
export async function ungroup(db: WorkoutDB, planId: string, key: string): Promise<void> {
  await db.transaction('rw', db.planExercises, async () => {
    for (const e of (await getEntries(db, planId)).filter((x) => x.groupKey === key)) await db.planExercises.update(e.id, NO_GROUP);
  });
}

/** Take one exercise out of its group; it goes just after the group. A group left with one member is undone. */
export async function takeOutOfGroup(db: WorkoutDB, entryId: string): Promise<void> {
  await db.transaction('rw', db.planExercises, async () => {
    const entry = await db.planExercises.get(entryId);
    if (!entry?.groupKey) return;
    const key = entry.groupKey;
    const entries = (await getEntries(db, entry.planId)).filter((e) => e.id !== entryId);
    const lastMember = entries.reduce((at, e, i) => (e.groupKey === key ? i : at), -1);
    entries.splice(lastMember + 1, 0, { ...entry, ...NO_GROUP });
    for (let n = 0; n < entries.length; n++) {
      const e = entries[n];
      if (e.id === entryId) await db.planExercises.update(e.id, { ...NO_GROUP, order: n });
      else if (e.order !== n) await db.planExercises.update(e.id, { order: n });
    }
    const rest = entries.filter((e) => e.groupKey === key);
    if (rest.length < 2) for (const e of rest) await db.planExercises.update(e.id, NO_GROUP);
  });
}
