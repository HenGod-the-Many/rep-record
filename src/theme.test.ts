import { afterEach, describe, expect, it } from 'vitest';
import { getThemeChoice, parseChoice, resolveTheme, setThemeChoice, THEME_KEY } from './theme';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe('light and dark (W-20, R-16.2)', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('auto follows the phone; a manual choice wins over the phone', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('anything unknown in storage counts as auto', () => {
    expect(parseChoice(null)).toBe('auto');
    expect(parseChoice('purple')).toBe('auto');
    expect(parseChoice('dark')).toBe('dark');
  });

  it('keeps the choice, and going back to auto clears it', () => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
    expect(getThemeChoice()).toBe('auto');
    setThemeChoice('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(getThemeChoice()).toBe('dark');
    setThemeChoice('light');
    expect(getThemeChoice()).toBe('light');
    setThemeChoice('auto');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(getThemeChoice()).toBe('auto');
  });

  it('with no storage at all (blocked), it falls back to auto without throwing', () => {
    expect(getThemeChoice()).toBe('auto');
    expect(() => setThemeChoice('dark')).not.toThrow();
  });
});
