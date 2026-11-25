import { describe, expect, it } from 'vitest';
import { WorkoutDB } from './db';
import { exportData, readBackup, restoreBackup } from './backup';
import {
  createFolder,
  deleteFolder,
  duplicateFolder,
  listFolders,
  moveFolder,
  plansInFolder,
  renameFolder,
  setPlanFolder,
} from './folders';
import { addEntry, duplicatePlan, getEntries, listPlans } from './plans';
import { exerciseId, freshDb, planId } from '../test/helpers';

describe('folders (R-02.5)', () => {
  it('create, rename and list folders in order', async () => {
    const db = await freshDb();
    const a = await createFolder(db, '  Block A ');
    const b = await createFolder(db, 'Block B');
    await renameFolder(db, a, 'Block A (heavy)');
    expect((await listFolders(db)).map((f) => [f.id, f.name])).toEqual([
      [a, 'Block A (heavy)'],
      [b, 'Block B'],
    ]);
  });

  it('refuses an empty name or a name already used', async () => {
    const db = await freshDb();
    await expect(createFolder(db, '   ')).rejects.toThrow('name');
    await createFolder(db, 'Block A');
    await expect(createFolder(db, 'block a')).rejects.toThrow('already');
  });

  it('reorders folders up and down', async () => {
    const db = await freshDb();
    const a = await createFolder(db, 'A');
    const b = await createFolder(db, 'B');
    const c = await createFolder(db, 'C');
    await moveFolder(db, c, -1);
    expect((await listFolders(db)).map((f) => f.id)).toEqual([a, c, b]);
    await moveFolder(db, a, -1); // already first: nothing changes
    expect((await listFolders(db)).map((f) => f.id)).toEqual([a, c, b]);
  });

  it('a plan moves into a folder and out again; it is in one folder at most', async () => {
    const db = await freshDb();
    const a = await createFolder(db, 'A');
    const b = await createFolder(db, 'B');
    const push = await planId(db, 'Push');
    await setPlanFolder(db, push, a);
    expect((await plansInFolder(db, a)).map((p) => p.id)).toEqual([push]);
    await setPlanFolder(db, push, b);
    expect(await plansInFolder(db, a)).toEqual([]);
    expect((await plansInFolder(db, b)).map((p) => p.id)).toEqual([push]);
    await setPlanFolder(db, push, null);
    expect((await plansInFolder(db, null)).map((p) => p.id)).toContain(push);
  });

  it('deleting a folder keeps its plans, now outside any folder', async () => {
    const db = await freshDb();
    const a = await createFolder(db, 'A');
    const push = await planId(db, 'Push');
    await setPlanFolder(db, push, a);
    await deleteFolder(db, a);
    expect(await listFolders(db)).toEqual([]);
    const plan = await db.plans.get(push);
    expect(plan?.folderId ?? null).toBeNull();
    expect((await listPlans(db)).map((p) => p.id)).toContain(push);
  });

  it('duplicating a plan keeps it in the same folder', async () => {
    const db = await freshDb();
    const a = await createFolder(db, 'A');
    const push = await planId(db, 'Push');
    await setPlanFolder(db, push, a);
    const copy = await duplicatePlan(db, push);
    expect((await db.plans.get(copy))?.folderId).toBe(a);
  });
});

describe('duplicating a folder (R-02.6)', () => {
  it('makes "<name> (copy)" holding independent copies of every plan, with targets, alternates and warm-up', async () => {
    const db = await freshDb();
    const a = await createFolder(db, 'Block A');
    const push = await planId(db, 'Push');
    const pull = await planId(db, 'Pull');
    await db.warmups.add({ id: 'w1', name: 'Upper', moves: [{ name: 'Arm circles', reps: 10, seconds: null }] });
    await db.plans.update(push, { warmupId: 'w1' });
    await setPlanFolder(db, push, a);
    await setPlanFolder(db, pull, a);

    const copyId = await duplicateFolder(db, a);
    const folders = await listFolders(db);
    expect(folders.map((f) => f.name)).toEqual(['Block A', 'Block A (copy)']);
    const copies = await plansInFolder(db, copyId);
    expect(copies).toHaveLength(2);
    expect(copies.every((p) => p.id !== push && p.id !== pull)).toBe(true);

    const pushCopy = copies.find((p) => p.name.startsWith('Push'))!;
    expect(pushCopy.warmupId).toBe('w1');
    const orig = await getEntries(db, push);
    const copied = await getEntries(db, pushCopy.id);
    const shape = (es: typeof orig) => es.map((e) => [e.exerciseId, e.targetSets, e.repMin, e.repMax, e.alternateIds]);
    expect(shape(copied)).toEqual(shape(orig));

    // Editing the copy leaves the original alone.
    await addEntry(db, pushCopy.id, await exerciseId(db, 'Squat'));
    expect(await getEntries(db, push)).toHaveLength(orig.length);
    // The original folder still holds the originals.
    expect((await plansInFolder(db, a)).map((p) => p.id).sort()).toEqual([push, pull].sort());
  });

  it('a second copy gets a new name; each copy goes straight after the original', async () => {
    const db = await freshDb();
    const a = await createFolder(db, 'Block A');
    await createFolder(db, 'Block B');
    await duplicateFolder(db, a);
    await duplicateFolder(db, a);
    expect((await listFolders(db)).map((f) => f.name)).toEqual(['Block A', 'Block A (copy 2)', 'Block A (copy)', 'Block B']);
  });
});

describe('saved data and backups', () => {
  it('data from version 6 upgrades with every plan outside any folder', async () => {
    const name = `test-v6-${Date.now()}`;
    const old = new WorkoutDB(name, 6);
    await old.open();
    await old.plans.add({ id: 'p1', name: 'Old plan', notes: '' });
    old.close();
    const db = new WorkoutDB(name);
    await db.open();
    expect(await listFolders(db)).toEqual([]);
    expect((await plansInFolder(db, null)).map((p) => p.id)).toEqual(['p1']);
  });

  it('folders survive a backup and restore', async () => {
    const db = await freshDb();
    const a = await createFolder(db, 'Block A');
    await setPlanFolder(db, await planId(db, 'Push'), a);
    const empty = await freshDb({ seed: false });
    const { backup } = readBackup(JSON.stringify(await exportData(db)), empty.verno);
    await restoreBackup(empty, backup);
    expect((await listFolders(empty)).map((f) => f.name)).toEqual(['Block A']);
    expect((await plansInFolder(empty, a)).map((p) => p.name)).toEqual(['Push']);
  });
});

describe('review fixes', () => {
  it('a plan naming a folder that no longer exists is listed as not in a folder', async () => {
    const db = await freshDb();
    const push = await planId(db, 'Push');
    await db.plans.update(push, { folderId: 'gone' });
    expect((await plansInFolder(db, null)).map((p) => p.id)).toContain(push);
  });
});
