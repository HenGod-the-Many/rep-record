import { useSyncExternalStore } from 'react';

/**
 * Light and dark (W-20, R-16.2). "auto" follows the phone. The choice is a
 * display preference kept on this device (localStorage), not in the database,
 * so backups are unchanged and the page can be coloured before React starts.
 */
export type ThemeChoice = 'auto' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'rr-theme';

/** Browser colour of the status bar / app chrome, matching --bg. */
export const THEME_COLOR: Record<Theme, string> = { light: '#F4F4F1', dark: '#0E0F11' };

export function parseChoice(raw: string | null | undefined): ThemeChoice {
  return raw === 'light' || raw === 'dark' ? raw : 'auto';
}

/** Which palette to show for a choice, given whether the phone is in dark mode. */
export function resolveTheme(choice: ThemeChoice, systemDark: boolean): Theme {
  if (choice === 'auto') return systemDark ? 'dark' : 'light';
  return choice;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // private mode or blocked storage: fall back to auto
  }
}

export function getThemeChoice(): ThemeChoice {
  return parseChoice(storage()?.getItem(THEME_KEY));
}

const listeners = new Set<() => void>();

function systemDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Put the choice on <html> (data-theme is only set for a manual choice) and update the status-bar colour. */
export function applyTheme(choice: ThemeChoice = getThemeChoice()): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  const color = THEME_COLOR[resolveTheme(choice, systemDark())];
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
}

export function setThemeChoice(choice: ThemeChoice): void {
  const s = storage();
  if (choice === 'auto') s?.removeItem(THEME_KEY);
  else s?.setItem(THEME_KEY, choice);
  applyTheme(choice);
  listeners.forEach((l) => l());
}

/** Follow the phone switching light/dark while the app is open (only matters for "auto"). */
export function watchSystemTheme(): void {
  if (typeof matchMedia !== 'function') return;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getThemeChoice,
  );
}
