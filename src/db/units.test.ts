import { describe, expect, it } from 'vitest';
import { displayNumber, formatWeight, fromDisplay, getUnit, LB_PER_KG, parseWeight, quickDrop, setUnit, stepWeight } from './units';
import { freshDb } from '../test/helpers';

describe('units', () => {
  it('defaults to lb and remembers kg', async () => {
    const db = await freshDb();
    expect(await getUnit(db)).toBe('lb');
    await setUnit(db, 'kg');
    expect(await getUnit(db)).toBe('kg');
  });

  it('switching units changes no stored value: 135 lb shows as 61.23 kg and back as 135 lb', async () => {
    const db = await freshDb();
    await db.setLogs.add({
      id: 'x', sessionId: 's', exerciseId: 'e', planExerciseId: null, setNumber: 1,
      parts: [{ weightLb: 135, reps: 8, seconds: null }], difficulty: null, toFailure: false, note: '', loggedAt: 1,
    });
    await setUnit(db, 'kg');
    const inKg = (await db.setLogs.get('x'))!.parts[0].weightLb;
    expect(formatWeight(inKg, await getUnit(db))).toBe('61.23 kg');
    await setUnit(db, 'lb');
    const back = (await db.setLogs.get('x'))!.parts[0].weightLb;
    expect(back).toBe(135);
    expect(formatWeight(back, await getUnit(db))).toBe('135 lb');
  });

  it('a weight typed in kg reads back the same in kg', () => {
    const lb = parseWeight('60', 'kg', null)!;
    expect(lb).toBeCloseTo(60 * LB_PER_KG, 10);
    expect(displayNumber(lb, 'kg')).toBe('60');
    expect(parseWeight('62.5', 'kg', null)).toBeCloseTo(62.5 * LB_PER_KG, 10);
  });

  it('re-entering the number already shown keeps the stored pounds exactly', () => {
    expect(parseWeight('61.23', 'kg', 135)).toBe(135);
    expect(parseWeight('', 'lb', 135)).toBeNull();
    expect(parseWeight('abc', 'lb', 135)).toBe(135);
  });

  it('± steps are 5 lb or 2.5 kg and never go below zero', () => {
    expect(stepWeight(135, 1, 'lb')).toBe(140);
    expect(stepWeight(135, -1, 'lb')).toBe(130);
    expect(displayNumber(stepWeight(fromDisplay(60, 'kg'), 1, 'kg'), 'kg')).toBe('62.5');
    expect(stepWeight(2, -1, 'lb')).toBe(0);
    expect(stepWeight(null, 1, 'lb')).toBe(5);
  });

  it('± lands on the step grid when the weight is between steps', () => {
    expect(displayNumber(stepWeight(135, 1, 'kg'), 'kg')).toBe('62.5'); // 61.23 kg -> 62.5
    expect(displayNumber(stepWeight(135, -1, 'kg'), 'kg')).toBe('60'); // 61.23 kg -> 60
    expect(stepWeight(132, 1, 'lb')).toBe(135);
    expect(stepWeight(132, -1, 'lb')).toBe(130);
  });

  it('quick drops round to 5 lb or 2.5 kg', () => {
    expect(quickDrop(135, 10, 'lb')).toBe(120); // 121.5 -> 120
    expect(quickDrop(135, 20, 'lb')).toBe(110); // 108 -> 110
    expect(quickDrop(135, 30, 'lb')).toBe(95); // 94.5 -> 95
    expect(displayNumber(quickDrop(fromDisplay(100, 'kg'), 20, 'kg'), 'kg')).toBe('80');
    expect(displayNumber(quickDrop(fromDisplay(60, 'kg'), 10, 'kg'), 'kg')).toBe('55'); // 54 -> 55
  });
});
