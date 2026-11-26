import type { Folder, Plan, WorkoutDB } from './db';
import { ValidationError } from './errors';
import { newId } from './ids';
import { duplicatePlan } from './plans';

/* Plan folders (W-18). One level of folders; a plan is in one folder at most. */

function cleanName(name: string): string {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) throw new ValidationError('Give the folder a name.');
  return n;
}

async function checkFree(db: WorkoutDB, name: string, except?: string): Promise<void> {
  const clash = (await db.folders.toArray()).some((f) => f.id !== except && f.name.toLowerCase() === name.toLowerCase());
  if (clash) throw new ValidationError(`A folder called "${name}" already exists.`);
}

export async function listFolders(db: WorkoutDB): Promise<Folder[]> {
  return db.folders.orderBy('order').toArray();
}

/**
 * The user's plans in a folder (null = not in any folder), by name. One-date
 * copies are never listed. A plan naming a folder that doesn't exist counts
 * as not in a folder, so it can never drop out of sight.
 */
export async function plansInFolder(db: WorkoutDB, folderId: string | null): Promise<Plan[]> {
  const folders = new Set((await db.folders.toArray()).map((f) => f.id));
  const where = (p: Plan) => (p.folderId && folders.has(p.folderId) ? p.folderId : null);
  return (await db.plans.filter((p) => !p.hidden && where(p) === folderId).toArray()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createFolder(db: WorkoutDB, name: string): Promise<string> {
  const n = cleanName(name);
  return db.transaction('rw', db.folders, async () => {
    await checkFree(db, n);
    const last = await db.folders.orderBy('order').last();
    const id = newId();
    await db.folders.add({ id, name: n, order: last ? last.order + 1 : 0 });
    return id;
  });
}

export async function renameFolder(db: WorkoutDB, id: string, name: string): Promise<void> {
  const n = cleanName(name);
  await db.transaction('rw', db.folders, async () => {
    if (!(await db.folders.get(id))) throw new ValidationError('That folder no longer exists.');
    await checkFree(db, n, id);
    await db.folders.update(id, { name: n });
  });
}

/** Move a folder up (-1) or down (+1) in the list. */
export async function moveFolder(db: WorkoutDB, id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.folders, async () => {
    const list = await db.folders.orderBy('order').toArray();
    const i = list.findIndex((f) => f.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((f, n) => db.folders.update(f.id, { order: n })));
  });
}

/** Delete a folder. Its plans are kept and move out of it. */
export async function deleteFolder(db: WorkoutDB, id: string): Promise<void> {
  await db.transaction('rw', [db.folders, db.plans], async () => {
    await db.plans.filter((p) => p.folderId === id).modify({ folderId: null });
    await db.folders.delete(id);
  });
}

/** Put a plan in a folder, or take it out (null). */
export async function setPlanFolder(db: WorkoutDB, planId: string, folderId: string | null): Promise<void> {
  await db.transaction('rw', [db.folders, db.plans], async () => {
    if (!(await db.plans.get(planId))) throw new ValidationError('That workout no longer exists.');
    if (folderId !== null && !(await db.folders.get(folderId))) throw new ValidationError('That folder no longer exists.');
    await db.plans.update(planId, { folderId });
  });
}

/**
 * Copy a folder: a new folder "<name> (copy)" right after it, holding an
 * independent copy of every plan in it (targets, alternates and warm-up).
 */
export async function duplicateFolder(db: WorkoutDB, id: string): Promise<string> {
  return db.transaction('rw', [db.folders, db.plans, db.planExercises], async () => {
    const folder = await db.folders.get(id);
    if (!folder) throw new ValidationError('That folder no longer exists.');
    const taken = new Set((await db.folders.toArray()).map((f) => f.name.toLowerCase()));
    const base = `${folder.name.replace(/ \(copy(?: \d+)?\)$/, '')} (copy)`;
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base.slice(0, -1)} ${n})`;

    // Place the copy straight after the original.
    const list = await db.folders.orderBy('order').toArray();
    const copyId = newId();
    const at = list.findIndex((f) => f.id === id) + 1;
    list.splice(at, 0, { id: copyId, name, order: 0 });
    await db.folders.add({ id: copyId, name, order: at });
    await Promise.all(list.map((f, n) => db.folders.update(f.id, { order: n })));

    for (const plan of await plansInFolder(db, id)) {
      const planCopy = await duplicatePlan(db, plan.id);
      await db.plans.update(planCopy, { folderId: copyId });
    }
    return copyId;
  });
}
