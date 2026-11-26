import { describe, expect, it } from 'vitest';
import { TABS, tabFor, tabPath } from './tabs';

const q = (s = '') => new URLSearchParams(s);
const route = (path: string) => {
  const [p, qs] = path.split('?');
  return tabFor(p.split('/').filter(Boolean), q(qs));
};

describe('four tabs (W-20, R-16.3)', () => {
  it('is Home, Calendar, Library, Progress, each with an icon and a label', () => {
    expect(TABS.map((t) => t.label)).toEqual(['Home', 'Calendar', 'Library', 'Progress']);
    for (const t of TABS) expect(t.icon).toBeTruthy();
  });

  it('old links open under the right tab', () => {
    expect(route('/today')).toBe('home');
    expect(route('')).toBe('home');
    expect(route('/settings')).toBe('home');
    expect(route('/log/abc')).toBe('home');
    expect(route('/calendar?m=2026-11')).toBe('calendar');
    expect(route('/day/2026-11-25')).toBe('calendar');
    expect(route('/move/2026-11-25')).toBe('calendar');
    expect(route('/splits')).toBe('library');
    expect(route('/splits/s1')).toBe('library');
    expect(route('/plans')).toBe('library');
    expect(route('/plans/p1/entry/e1')).toBe('library');
    expect(route('/pick?mode=add')).toBe('library');
    expect(route('/warmups/w1')).toBe('library');
    expect(route('/exercises')).toBe('library');
    expect(route('/exercises/x1')).toBe('library');
    expect(route('/body')).toBe('progress');
    expect(route('/body/photos')).toBe('progress');
  });

  it('a screen opened with a back link stays under the tab it came from', () => {
    expect(route('/exercises/x1/history?back=%2Fbody')).toBe('progress');
    expect(route('/exercises/x1/history?back=%2Fbody%2Fstats')).toBe('progress');
    expect(route('/exercises/x1/history')).toBe('library');
    expect(route('/exercises/x1/history?back=%2Flog%2Fs1')).toBe('home');
    expect(route('/plans/p1?back=%2Fday%2F2026-11-25%3Fback%3D%252Fcalendar')).toBe('calendar');
    expect(route('/day/2026-11-25?back=%2Ftoday')).toBe('home');
    // Progress -> history -> Edit: the edit form still sits under Progress.
    expect(route('/exercises/x1?back=' + encodeURIComponent('/exercises/x1/history?back=' + encodeURIComponent('/body')))).toBe('progress');
    expect(route('/log/s1?back=%2Fbody')).toBe('progress');
  });

  it('unknown routes fall back to Home', () => {
    expect(route('/nonsense')).toBe('home');
  });

  it('tapping a tab: Library goes back to the part last used', () => {
    expect(tabPath('home', '/plans')).toBe('/today');
    expect(tabPath('calendar', '/plans')).toBe('/calendar');
    expect(tabPath('library', '/plans')).toBe('/plans');
    expect(tabPath('progress', '/plans')).toBe('/body');
  });
});
