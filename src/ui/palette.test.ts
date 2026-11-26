import cssText from '../styles.css?raw';
import scriptText from '../../docs/design/contrast-check.py?raw';
import { describe, expect, it } from 'vitest';

/**
 * R-16.2: every colour pair passes docs/design/contrast-check.py. That script
 * measures its own copy of the palette, so this test makes sure the colours
 * the app actually uses (styles.css) are the ones the script measured.
 */
const css = cssText.split('\r\n').join('\n');
const script = scriptText.split('\r\n').join('\n');

/** CSS name -> script name. */
const NAMES: Record<string, string> = {
  bg: 'bg', surface: 'surface', 'surface-2': 'surface2', ink: 'ink', soft: 'soft', line: 'line',
  hairline: 'hairline', hero: 'hero', 'hero-ink': 'heroInk', 'hero-soft': 'heroSoft', accent: 'accent',
  'on-accent': 'onAccent', 'accent-text': 'accentText', track: 'track', danger: 'danger', good: 'good', 'chart-2': 'chart2',
};

function cssBlock(selectorStart: string): Record<string, string> {
  const i = css.indexOf(selectorStart);
  expect(i, `missing ${selectorStart}`).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2].toUpperCase();
  return out;
}

function scriptPalette(mode: 'light' | 'dark'): Record<string, string> {
  const m = script.match(new RegExp(`'${mode}': dict\\(([^)]*)\\)`));
  expect(m, `missing ${mode} palette in contrast-check.py`).not.toBeNull();
  const out: Record<string, string> = {};
  for (const kv of m![1].matchAll(/(\w+)='(#[0-9A-Fa-f]{6})'/g)) out[kv[1]] = kv[2].toUpperCase();
  return out;
}

describe('Plate colours in the app match the measured palette (W-20, R-16.2)', () => {
  const light = cssBlock(':root {');
  const darkMedia = cssBlock(":root:not([data-theme='light'])");
  const darkManual = cssBlock(":root[data-theme='dark']");

  it('light palette', () => {
    const want = scriptPalette('light');
    for (const [cssName, pyName] of Object.entries(NAMES)) expect(light[cssName], `--${cssName}`).toBe(want[pyName]);
  });

  it('dark palette, both when following the phone and when chosen by hand', () => {
    const want = scriptPalette('dark');
    for (const [cssName, pyName] of Object.entries(NAMES)) {
      expect(darkMedia[cssName], `--${cssName} (auto)`).toBe(want[pyName]);
      expect(darkManual[cssName], `--${cssName} (manual)`).toBe(want[pyName]);
    }
  });

  it('no colour outside the token blocks is written as a raw hex value', () => {
    const start = css.indexOf(':root {\n  /* Older');
    expect(start).toBeGreaterThan(0);
    const afterTokens = css.slice(start);
    expect(afterTokens.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).toEqual([]);
  });
});
