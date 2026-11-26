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

function sectionTab(section: string): TabKey {
  for (const t of TABS) if (SECTIONS[t.key].includes(section)) return t.key;
  return 'home';
}

/**
 * Which tab a route belongs to. A screen opened with a back link stays under
 * the tab it was opened from: an exercise's history opened from Progress, or
 * from the workout being logged, doesn't jump to Library.
 */
export function tabFor(parts: string[], query: URLSearchParams): TabKey {
  const back = query.get('back');
  if (back?.startsWith('/')) return sectionTab(back.split(/[/?]/).filter(Boolean)[0] ?? '');
  return sectionTab(parts[0] ?? '');
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
