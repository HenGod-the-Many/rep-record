import { describe, expect, it } from 'vitest';
import { UndoManager } from './undo';
import { createSplit, deleteSplit, getSplitDays, setSplitDayWorkouts } from './db/schedule';
import { freshDb, planId } from './test/helpers';

describe('undo after deleting a split', () => {
  it('a split created afterwards cancels the Undo instead of being thrown away by it', async () => {
    const db = await freshDb();
    const undo = new UndoManager(db);
    const a = (await db.splits.toArray())[0].id;
    await undo.run('Deleted A', () => deleteSplit(db, a));
    expect(undo.current()).not.toBeNull();
    const b = await createSplit(db, 'B', 7);
    expect(undo.current()).toBeNull();
    await undo.undo(); // nothing pending: no change
    expect(await db.splits.get(b)).toBeDefined();
  });

  it('editing another split afterwards also cancels it', async () => {
    const db = await freshDb();
    const undo = new UndoManager(db);
    const c = await createSplit(db, 'C', 2);
    const a = (await db.splits.toArray()).find((s) => s.id !== c)!.id;
    await undo.run('Deleted A', () => deleteSplit(db, a));
    const day = (await getSplitDays(db, c))[0];
    await setSplitDayWorkouts(db, day.id, [{ planId: await planId(db, 'Pull'), time: 'noon' }]);
    expect(undo.current()).toBeNull();
    expect((await getSplitDays(db, c))[0].workouts).toHaveLength(1);
  });

  it('with nothing else changed, Undo brings the split back', async () => {
    const db = await freshDb();
    const undo = new UndoManager(db);
    const a = (await db.splits.toArray())[0].id;
    await undo.run('Deleted A', () => deleteSplit(db, a));
    await undo.undo();
    expect(await db.splits.get(a)).toBeDefined();
    expect(await getSplitDays(db, a)).toHaveLength(7);
  });
});
