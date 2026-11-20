# W-12: Stats overview with cards you choose

Status: approved 2026-11-20 by Claude on Taylor's say-so (Taylor delegated release-2 spec approval); reviewed by acceptance-reviewer, fixes made. Taylor can overrule any answer under "Answers".
Cleared to run unattended: yes
Satisfies: R-11.1, R-11.2

## Goal

One glance to see how training and body are going this week, without opening
each exercise or metric. Taylor picks what matters; the rest stays hidden.

## Done when

- *Stats screen (R-11.1).* The Body tab from W-11 becomes **Stats**: the
  cards at the top, the body metrics list below. — demonstration
- *Cards available (R-11.1).* Each card shows one number (or a short list)
  and what it is:
  - Bodyweight: latest entry, its date, and the 7-day average.
  - Workouts this week, and Workouts this month (two cards): finished
    sessions, the week following the "first day of the week" setting
    (`weekStart`, R-03.7), the month by calendar month.
  - Sets this week: logged sets of lifting exercises (activities from W-15
    are not sets and are left out).
  - Volume this week: sum of weight × reps over every part of every weight
    set this week, in the display unit. Bodyweight and timed sets are left
    out, and the card says so.
  - Recent PRs: the last 5 new records (heaviest weight or best estimated
    1-rep max, as defined in W-08), with exercise and date. An exercise's
    first-ever session sets its starting mark and is not counted as a PR.
  - One card per switched-on metric: its latest value and date.
  - Activities this week (only once W-15 is built): count, total time and
    distance.
  Every number is checked by a test against generated data with known
  answers. — test
- *Choose and order (R-11.2).* **Edit cards** shows every available card with
  a switch and up/down buttons. The choice and order are saved in settings
  and are the same after closing the app. A card whose metric is switched
  off disappears and comes back with it. Default, in order: Workouts this
  week, Sets this week, Recent PRs, Bodyweight. — test
- *Empty states.* A card with no data says so ("No workouts this week")
  instead of showing 0 or a blank. — test
- *Tap through.* Tapping a card opens what it summarises (the metric page,
  the exercise history, the calendar). — demonstration
- Controls are at least 44 × 44 points; phone-size screenshots of the
  default cards and Edit cards. — demonstration
- The project's check command passes: `npm run check`

## Out of scope

Charts on the cards, cards for energy/sleep/soreness from the journal, goals,
streaks, sharing a stats image, Apple Health numbers (W-13).

## Decisions already made

- The week follows the existing "first day of the week" setting
  (`weekStart`, R-03.7).
- PRs as defined in W-08; bodyweight average as defined in W-11.
- Card choice lives in the `settings` table; no database version change.

## Riskiest assumption

That counting a year of sets for "Recent PRs" is fast enough to open the tab
instantly. Test with generated data (300 sessions × 20 sets) in a desktop
browser at phone size; if it takes more than half a second, keep a running
record list updated when a set is logged.

## Slices

1. Card functions with tests against generated data; settings for choice and
   order.
2. Stats screen and Edit cards; rename the tab.
3. Screenshots, `npm run check`, review.

## Stop and ask if

- A requirement looks wrong, or a test looks wrong.
- The same failure happens twice.

## Acceptance script

Release 2 step 8 in [verification-plan.md](../verification-plan.md).

## Answers (decided 2026-11-20 under Taylor's delegation; Taylor can overrule)

1. Volume counts weight sets only (weight × reps); bodyweight sets are left
   out and the card says so.
2. (Removed: the week follows the existing first-day-of-week setting.)
