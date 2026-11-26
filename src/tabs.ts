import type { IconName } from './ui/icons';

/**
 * The four tabs (W-20, R-16.3): Home, Calendar, Library, Progress. Every
 * existing route still works; this only decides which tab a screen sits
 * under and where a tab goes when tapped.
 */
export type TabKey = 'home' | 'calendar' | 'library' | 'progress';

export interface Tab {
  key: TabKey;
  label: string;
  icon: IconName;
}

export const TABS: Tab[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'library', label: 'Library', icon: 'library' },
  { key: 'progress', label: 'Progress', icon: 'progress' },
];

const SECTIONS: Record<TabKey, string[]> = {
  home: ['', 'today', 'settings', 'log'],
  calendar: ['calendar', 'day', 'move'],
  library: ['library', 'splits', 'plans', 'pick', 'warmups', 'exercises'],
  progress: ['body'],
};

/** Which tab a route belongs to. An exercise's history opened from Progress stays under Progress. */
export function tabFor(parts: string[], query: URLSearchParams): TabKey {
  const [section = '', , sub] = parts;
  if (section === 'exercises' && sub === 'history' && query.get('back')?.startsWith('/body')) return 'progress';
  for (const t of TABS) if (SECTIONS[t.key].includes(section)) return t.key;
  return 'home';
}

/** Where tapping a tab goes. Library reopens the part last used. */
export function tabPath(key: TabKey, lastLibrary: string): string {
  switch (key) {
    case 'home':
      return '/today';
    case 'calendar':
      return '/calendar';
    case 'library':
      return lastLibrary;
    case 'progress':
      return '/body';
  }
}
