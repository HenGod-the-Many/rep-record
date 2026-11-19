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
    const stored = 135;
    expect(formatWeight(stored, 'kg')).toBe('61.23 kg');
    expect(formatWeight(stored, 'lb')).toBe('135 lb');
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

  it('quick drops round to 5 lb or 2.5 kg', () => {
    expect(quickDrop(135, 10, 'lb')).toBe(120); // 121.5 -> 120
    expect(quickDrop(135, 20, 'lb')).toBe(110); // 108 -> 110
    expect(quickDrop(135, 30, 'lb')).toBe(95); // 94.5 -> 95
    expect(displayNumber(quickDrop(fromDisplay(100, 'kg'), 20, 'kg'), 'kg')).toBe('80');
    expect(displayNumber(quickDrop(fromDisplay(60, 'kg'), 10, 'kg'), 'kg')).toBe('55'); // 54 -> 55
  });
});
