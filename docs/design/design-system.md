# Rep Record design system: Plate

The rules every screen follows from W-20 on. Chosen by Taylor 2026-11-25
("Plate for sure") from three directions on the
[step 2 canvas](https://claude.ai/artifact/Mg4JmpVt4THJMbJqAE5RKw); source of the
mock-ups in [home-directions/](home-directions/). Decision record:
[0008](../decisions/0008-plate-design-system.md).

**The idea in one line:** the look of a weight room. Tall condensed type for
names and numbers, near-black and off-white like iron and chalk, one hot orange
for the thing to do next. Numbers are the heroes; everything else stays quiet.

## 1. Colour

Two palettes; the app follows the phone's light/dark setting
(`prefers-color-scheme`), with a manual override in Settings (Auto, Light,
Dark). Every pair below is measured by
[contrast-check.py](contrast-check.py) (`python -X utf8 docs/design/contrast-check.py`,
exits non-zero on a failure). Change a colour only together with that script.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | #F4F4F1 | #0E0F11 | The page |
| `--surface` | #FFFFFF | #18191D | Cards, tiles, sheets, fields |
| `--ink` | #111214 | #F2F2F0 | Main text, icons |
| `--soft` | #555A62 | #A4A9B1 | Secondary text, labels, inactive tabs |
| `--line` | #7D828A | #6B7079 | Edges of fields and outlined buttons (3 : 1) |
| `--hairline` | #D6D8DC | #2D3036 | Dividers between rows only (decorative, never the only edge of a control) |
| `--hero` | #111214 | #1E2025 | The one "do this now" card (today's workout, the running exercise) |
| `--hero-ink` / `--hero-soft` | #F4F4F1 / #B9BDC4 | #F2F2F0 / #A9AEB6 | Text on the hero card |
| `--accent` | #C2410C | #FF7A3D | The main action's fill, filled progress |
| `--on-accent` | #FFFFFF | #111214 | Text on an accent fill |
| `--accent-text` | #B23C0B | #FF8A55 | Accent used as text: current tab, PR numbers, links |
| `--track` | #8E939B | #686D76 | Empty part of progress bars and segments |
| `--danger` | #B42318 | #FF7B72 | Delete, Remove, Clear (text only, never a big red fill) |
| `--good` | #1D7A3E | #5FD08F | Up-trend text ("+8% on last week") |

Rules:

- **One accent fill per screen**: the main action (Start workout, Log set).
  Everything else is outlined or plain text.
- Orange means "act" or "personal best", never decoration.
- Trend colour is never the only signal: up/down also has an arrow or a sign.

## 2. Type

Two families, both under the SIL Open Font License, **bundled with the app**
(the app must work offline, so no Google Fonts link at run time):

- **Barlow Condensed** 700/800: screen titles, workout and exercise names,
  every number that matters (weights, reps, stats). Upper case for titles and
  section labels.
- **Inter** 400/500/600/700: everything else.

Sizes are in `rem` from a root that follows the iPhone's text-size setting
(Dynamic Type: `html { font: -apple-system-body }`, then our families on
top), so a larger phone text size makes the whole app larger. At the default
size 1 rem = 17 px.

| Role | Family | Size (default) | Weight | Case |
|---|---|---|---|---|
| Screen title (top-level tabs) | Barlow Condensed | 3.05 rem (52 px) | 800 | UPPER |
| Screen title (pushed screens) | Barlow Condensed | 1.9 rem (32 px) | 700 | UPPER |
| Hero name (workout on its card) | Barlow Condensed | 2.35 rem (40 px) | 800 | UPPER |
| Big number (stat strip) | Barlow Condensed | 2.35 rem (40 px) | 700 | — |
| Tile number | Barlow Condensed | 1.75 rem (30 px) | 700 | — |
| Set numbers (weight, reps in steppers) | Barlow Condensed | 1.5 rem (26 px) | 700 | — |
| Button label, main action | Barlow Condensed | 1.4 rem (24 px) | 700 | UPPER |
| Body | Inter | 1 rem (17 px) | 400 | — |
| Row title | Inter | 1 rem | 500 | — |
| Secondary / caption | Inter | 0.8 rem (13–14 px) | 400 | — |
| Section label | Inter | 0.77 rem (13 px) | 700 | UPPER, 0.08 em tracking |
| Tab label | Inter | 0.65 rem (11 px) | 600 (700 current) | UPPER |

No other sizes. Nothing below 11 px.

## 3. Space, shape, size

- **Spacing scale (px):** 4, 8, 12, 16, 20, 24, 32. Screen side margin 20.
  Between sections 18–24; inside a card 14–18.
- **Corners:** 18 for cards and sheets, 14 for tiles and buttons, 12 for small
  controls and fields, round (999) for chips only.
- **Touch targets:** at least 44 × 44 pt, 48 for anything used mid-set.
  The main action is 56 tall, full width of its card.
- **Edges:** fields and outlined buttons get a 1.5 px `--line` edge. Cards on
  the page get a 1 px `--hairline` edge plus their fill difference; the hero
  card has no edge.

## 4. Icons

Inline stroke SVG, 24 × 24 viewbox, 1.8 stroke (2 for the current tab), round
caps and joins, `currentColor`. Never emoji (the bin emoji on the logging
screen goes). Icon-only buttons carry an `aria-label`. One set, drawn in the
same hand: home, calendar, library (books), progress (bars), gear, play,
plus, minus, check, more (…), chevron, bin, arrows up/down, drag handle,
search, close.

## 5. Navigation (option A)

Four tabs, icon + label, bottom of the screen: **Home · Calendar · Library ·
Progress**. The current tab is `--accent-text` with a heavier label and is
announced (`aria-current="page"`).

- **Home:** today's workout card (Start), This week strip, Trends tiles, day
  note, backup reminder when due. Settings behind a gear at top right.
- **Calendar:** month view; done, planned and missed days look different.
- **Library:** one screen, a segmented switch at the top: **Programs ·
  Workouts · Exercises · Warm-ups**.
- **Progress:** PRs, charts, body metrics; tapping an exercise opens its
  history first (Edit is a button there).

Words: **Program** (was "split"), **Workout** (was "plan"). A logged workout
on a date is still "a workout"; the context makes it clear.

## 6. Components

Each one is built once in `src/ui/` and reused; screens don't restyle them.

- **Large title:** small date or context line in `--soft`, then the title.
  Top-level screens only; pushed screens get a back button and the smaller
  title.
- **Hero card:** `--hero` fill, 18 radius. Context line (section label style,
  `--hero-soft`), name (hero size), one line of facts, then the main action.
  At most one per screen.
- **Main action button:** `--accent` fill, `--on-accent` label, 56 tall, 14
  radius, icon + upper-case Barlow label.
- **Secondary button:** `--surface` fill, 1.5 px `--line` edge, `--ink`
  label in Inter 600. 48 tall.
- **Text button:** `--accent-text`, no underline unless inside a sentence.
- **Destructive action:** text button in `--danger`, inside a "…" menu or a
  confirm sheet. Never sits beside the main action.
- **Stat strip:** three equal columns between a 2 px `--ink` rule above and a
  `--hairline` below; big number over a caption; each column taps through to
  Progress.
- **Metric tile:** `--surface`, hairline edge, label, tile number with a
  small unit, one caption line or a segment bar. The whole tile is a button
  (bodyweight's tile opens "add today's value").
- **Segment bar:** N equal segments, 6 tall, 4 gap, filled `--accent`, empty
  `--track`.
- **List row:** at least 56 tall, title (Inter 500) and optional caption,
  value or chevron at the right, `--hairline` between rows.
- **Segmented switch:** for Library and other 2–4-way choices; selected
  segment `--ink` fill with `--bg` text.
- **Stepper:** − value + with the value in Barlow; 48 tall; value typeable.
- **"…" menu / sheet:** rare and risky actions (Replace, Remove, Clear day,
  Delete, Move day) live here, not as buttons on the screen.
- **Reorder:** a drag handle on each row; ▲ ▼ buttons stay available in the
  "…" menu for accessibility.
- **Saving:** everything saves as you change it. Where a change is big
  (deleting, changing every future date), a confirm sheet says what will
  happen. No Save buttons on edit screens.

## 7. Motion

Short and functional: 150–200 ms ease-out for sheets, folding and tab
changes. Nothing moves when "Reduce Motion" is on.

## 8. Checks before any screen ships

1. `contrast-check.py` passes; any new colour pair is added to it first.
2. Both modes screenshotted at 390 × 844.
3. Every control at least 44 × 44 pt; icon-only controls labelled.
4. Text still fits at the largest standard iPhone text size (no clipped
   numbers; long names wrap).
5. Focus ring visible on every control (`--accent-text`, 3 px, offset 2).
