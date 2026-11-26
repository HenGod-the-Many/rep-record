# W-20: UI redesign (Plate, four tabs, home screen)

Status: approved by Taylor 2026-11-25 ("Yes to all. Approved."): all six default answers.
Cleared to run unattended: yes, once approved
Satisfies: KF-16 (new), R-16.1–R-16.7 (new)

## Goal

Make Rep Record feel sleek, modern and easy to get around, as Taylor asked
after release 3. The logging speed stays exactly as it is; what changes is
the look (the Plate design system) and getting around (four tabs, a real home
screen, setup grouped in one Library). Background: the
[UI review brief](../ui-review-brief.md), the
[audit](https://claude.ai/artifact/2PvXoTtXL2MpDM7hiS1tM3), the
[chosen direction](https://claude.ai/artifact/Mg4JmpVt4THJMbJqAE5RKw), the
[design system](../design/design-system.md) and
[decision 0008](../decisions/0008-plate-design-system.md).

## Done when

- *R-16.1 Look.* Every screen uses the Plate tokens, type and components
  from the design system; the old grey card style and the bin emoji are gone.
  — demonstration (screenshots of every screen, both modes)
- *R-16.2 Light and dark.* The app follows the phone's light/dark setting;
  Settings offers Auto, Light, Dark and keeps the choice. Every colour pair
  passes `docs/design/contrast-check.py`. — test, demonstration
- *R-16.3 Four tabs.* The tab bar is Home, Calendar, Library, Progress, each
  with an icon and a label; the current tab is announced to VoiceOver. Every
  existing screen is reachable, and old links (`/today`, `/plans`, `/splits`,
  `/exercises`, `/body`) still open the right place. — test, demonstration
- *R-16.4 Home.* Opens on: today's workout card with Start (or Resume); This
  week: new PRs, workouts, minutes exercised; Trends: bodyweight (tap to add
  today's value), week streak, weekly volume, plan adherence; the day note;
  the backup reminder when due. Settings behind a gear. Tapping a This-week
  number or trend opens its detail in Progress. — test (each number has a
  known-answer test), demonstration
- *R-16.5 Library.* One screen with a switch: Programs · Workouts · Exercises
  · Warm-ups. On screen "split" reads **Program** and "plan" reads
  **Workout** everywhere; stored data and backups are unchanged. — test,
  demonstration
- *R-16.6 Progress.* PRs, stats cards, body metrics and charts in one tab;
  tapping an exercise opens its history first, with Edit as a button.
  — demonstration
- *R-16.7 Fewer taps, calmer screens.* Add bodyweight is 2 taps plus typing
  (from 4); rare and risky actions (Replace, Remove, Clear day, Delete, Move
  day) sit in a "…" menu, not beside the main action; the calendar shows
  done, planned and missed days differently. — demonstration (tap counts
  re-measured against the audit)
- Text follows the iPhone's text size (rem from Dynamic Type); every control
  at least 44 × 44 pt with a visible focus ring. — demonstration
- Logging is no slower: a set is still one tap when last time's numbers are
  right, and every existing logging test passes unchanged. — test
- The app still works offline (fonts bundled; no network request at start).
  — demonstration
- `npm run check` passes.

**Definitions** (new functions, each with tests):
- *Minutes exercised this week:* for each finished workout, finish time minus
  start time, capped at 4 hours; plus the duration of each logged activity.
  Clarified while building (slice 3, 2026-11-25): activities are logged inside
  a workout, so each workout counts once, as the longer of its start-to-finish
  time and its activity time (an unfinished workout counts its activity time
  only). Adding both would count the same minutes twice.
- *Week streak:* weeks in a row, ending this week or last week, with at least
  one finished workout or activity. Weeks start on the existing week setting.
- *Weekly volume:* the existing lifting volume for this week, and the change
  in percent against last week.
- *Plan adherence:* workouts finished this week out of workouts scheduled
  this week (from programs and one-date changes).

## Out of scope

The future features W-21 to W-24 (predictions, balance, recommendations);
drag-to-reorder (▲ ▼ stays, restyled); new data or a database upgrade;
changing what a backup contains; a tablet or desktop layout.

## Riskiest assumption

That restyling every screen can be done in slices without breaking logging.
Logging is the part Taylor uses mid-set, and it has the most code. It is
restyled last and only visually, with its tests untouched.

## Slices

Each slice is its own pull request to dev, reviewed, so dev stays usable.

1. **Foundation:** tokens for both palettes, theme setting, bundled fonts, rem
   type scale, `src/ui/` components (buttons, cards, tiles, segment bar, list
   row, segmented switch, "…" menu, icons). Existing screens pick up
   the new colours and type straight away. (The stepper moved to slice 7,
   since only logging uses it.)
2. **Navigation:** four tabs with icons, Library switch, old routes
   redirected, words Program and Workout on screen.
3. **Home:** the four new numbers (tests first), hero card, stat strip,
   trend tiles, quick bodyweight entry, gear to Settings.
4. **Progress:** Stats and Body merged; exercise history first.
5. **Calendar and day screens:** done, planned and missed states; "…" menus.
6. **Library screens:** Programs, Workouts, Exercises, Warm-ups restyled;
   "…" menus for rare actions.
7. **Logging screen:** restyle only (Plate stepper component, hero card for the
   current exercise, icons for delete and more); no change to behaviour.
8. **Finish:** both-mode screenshots of every screen, tap counts,
   accessibility pass, release as v0.9.0 on Taylor's OK.

## Stop and ask if

- A slice would change how logging behaves, or any stored data.
- A requirement or a test looks wrong; the same failure happens twice.
- A colour fails the contrast script and the fix changes the look noticeably.

## Acceptance script

1. Open the app: Home shows today's workout, This week and Trends.
2. Tap bodyweight, type today's weight, done: the tile shows it.
3. Start the workout from Home and log a set in one tap.
4. Switch the phone to light mode: the app follows; set Dark in Settings and
   it stays dark.
5. Library → Programs, Workouts, Exercises, Warm-ups each open; no screen
   says "split" or "plan".
6. Progress → an exercise opens its history.
7. Turn on airplane mode, close and reopen: everything still loads, fonts
   included.

## Answers (approved by Taylor 2026-11-25: every default in bold)

1. Theme choice in Settings (Auto, Light, Dark), or follow the phone only?
   Default: **Auto, Light, Dark**.
2. Edit screens: save as you change (no Save buttons), with a confirm only
   for big changes? Default: **save as you change**.
3. Minutes exercised: workout start to finish (capped at 4 hours) plus
   activity durations? Default: **yes**.
4. Week streak counts a week with any finished workout **or activity**?
   Default: **yes, either**.
5. Release when all slices are in (v0.9.0), not slice by slice? Default:
   **release when all slices are in**; dev stays usable throughout.
6. Bundle the two fonts (about 100–200 KB more to download once)? Default:
   **yes**.
