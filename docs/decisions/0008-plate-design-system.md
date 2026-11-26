# 0008: Plate design system, four-tab navigation, bundled fonts

Date: 2026-11-25 (UI review step 3)

## Context

Taylor called the UI "bland and clunky". The audit (step 1) found six
text-only tabs, no home screen, one grey card style and no light mode. Taylor
then chose: navigation option A (Home, Calendar, Library, Progress), the names
"Program" (was split) and "Workout" (was plan), restyle and rework the flows,
light and dark following the phone, and the **Plate** visual direction from
three mock-ups (step 2).

## Decision

- The look is **Plate**, written down in
  [docs/design/design-system.md](../design/design-system.md): Barlow Condensed
  for titles and numbers, Inter for text, near-black / off-white with one
  orange accent, two measured palettes.
- **Colours are CSS custom properties** with a light and a dark set, chosen by
  `prefers-color-scheme` and overridable in Settings. Every text and control
  pair passes WCAG 2.1 AA in both modes, measured by
  `docs/design/contrast-check.py`.
- **Fonts are bundled** with the app (both SIL Open Font License), so the app
  keeps working offline and no request leaves the phone.
- **Type sizes are in rem from the iPhone's text-size setting** (Dynamic Type),
  not fixed pixels.
- **Navigation is four tabs**, with the setup things grouped in Library.
  Routes and stored data keep their old names (`plans`, `splits` in the
  database and URLs); only the words on screen change, so backups and saved
  data are untouched.

## Rejected

- **Calm** (soft, rounded, iPhone-like) and **Gauge** (thin-line instrument
  look): Taylor picked Plate.
- **Loading fonts from Google Fonts at run time:** breaks offline use (the app
  is used in gyms with poor signal) and sends a request to Google on every
  start.
- **System font only:** smallest and simplest, but the condensed numbers are
  most of Plate's character.
- **Renaming the database tables to programs and workouts:** a schema change
  and a backup-format change for no visible gain.

## Consequences

Every screen is restyled (W-20), so this touches almost every screen file.
`styles.css` moves to tokens; the shared pieces live in `src/ui/`. The app
grows by the font files (about 100–200 KB for the weights used). Any new
colour must be added to the contrast script before it is used.
