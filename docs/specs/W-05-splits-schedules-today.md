# W-05 Splits, schedules and Today, and W-14 Rescheduling

Two items, one spec: W-05 puts workouts on the calendar, W-14 moves them around
when life gets in the way. Both are release 1.

**What it is for.** Taylor can set up the weekly split, put it on the calendar,
see today's workouts, and when a day is missed, fix the week in a few taps:
shift the week, shift everything after, or change single days.

## W-05: splits, schedules, calendar, Today

**Done when.**
- *Splits (R-03.1, R-03.2, R-03.6).* A Splits screen lists splits. A split has
  a name and a cycle length in days or weeks (stored as days). Each day of the
  cycle is Rest or one or more workouts, each with a time: Morning, Noon,
  Evening, Night, or a custom clock time. You can create, edit, duplicate and
  delete a split. The seeded 7-day default split is there on first launch.
- *Schedules (R-03.3, R-03.5).* From a split, "Schedule" asks for a start date
  and a length in days or weeks. Every date in that range gets the split's day
  for `(date − start + offset) mod cycle`; dates outside any schedule show
  nothing. Where two schedules cover the same date, the most recently created
  one wins. Schedules can be listed and deleted.
- *Week start (R-03.7).* Monday by default; Settings can change it.
- *Calendar.* A month view shows each date's workouts (or Rest), marks dates
  that were changed by hand, and moves month to month.
- *Single-date override (R-04.1).* Tapping a date lets you set its workouts for
  that date only, or reset it to what the split says.
- *Today (R-03.4).* The home screen shows today's workouts in time order (or
  Rest, or "Nothing scheduled") with their exercises and targets. What a date
  shows depends only on the calendar and the changes you make, never on what
  was logged, so a missed day never shifts anything by itself. "Start workout"
  is shown; logging itself is W-06.

## W-14: rescheduling

**Done when.**
- *Move a day.* On the calendar or Today, "Move" on a planned day asks for the
  new date (later or earlier; earlier added by Taylor on 2026-11-18) and whether
  to move **within the week** or **all future**.
- *Within the week (R-04.4).* The moved day and the workouts after it keep their
  order and are pushed later only as far as needed; each rest day they reach
  absorbs the push. Nothing goes past the last day of the week.
  Example, Mon–Sun week, Push · Pull · Legs · Rest · CBA · S&L · Rest, moving
  Monday to Tuesday gives: Mon empty · Push · Pull · Legs · CBA · S&L · Rest.
- *Rest-day alert (R-04.5).* Before you confirm, if fewer rest days remain from
  the new date to the end of the week than before (2 → 1 in the example), the
  app says so.
- *Not enough room (R-04.6).* If workouts would spill past the end of the week,
  the app asks: drop the last ones, or pick which to drop. Dropped workouts are
  not carried into next week.
- *All future (R-04.7).* The schedule is split at the moved date: days before
  stay as they were; from the new date on, the same sequence continues with
  rest days unchanged, N days later. The schedule's end moves out by N days.
  Hand-made changes after that date move with it.
- *Quick day edits (R-04.8).* On any planned date: Clear (make it Rest),
  Replace (pick another plan), Add workout (with a time). Date only.
- *Edit one date's workout (R-04.9).* Changing exercises or targets for a date
  makes a copy for that date; the plan is untouched. The edited workout shows a
  "Keep these changes" button offering "Update the plan everywhere" or "Save as
  a new plan".
- *Undo.* Every move or day edit can be undone right after it is made.

## Both items

- Dates are local calendar dates (`YYYY-MM-DD`), so daylight saving or a time
  zone change can never move a workout to another day.
- Unit tests cover: cycle maths across cycle, month and year boundaries;
  schedule range edges; overlapping schedules; overrides; several workouts on
  one date in time order; custom week start; within-week moves (the example
  above, a move with no rest day to absorb it, overflow with each cut choice,
  the rest-day alert firing and not firing); all-future moves (dates before
  unchanged, sequence and rest days kept, end moved out); quick edits; editing
  one date then updating the plan or saving a new plan; undo; a DST week.
- Phone-size (390 × 844) screenshots of Splits, split editor, Schedule,
  Calendar, Today, Move (both modes, with the alert and the cut choice) and a
  day edit; every control at least 44 × 44 points.

**Data shape.** Split days, overrides and date changes hold a list of workouts,
each with a time; a schedule gains an offset so "all future" can continue the
sequence. No real data exists yet, so the stored shape changes without a
migration (database version 2).

**Out of scope.** Logging (W-06), activities like runs and rides (W-15) and
warm-ups (W-16), notifications or reminders, moving workouts across weeks
other than "all future", recurring overrides.

**Riskiest assumption.** The within-week push and the all-future split can be
expressed on top of schedules plus per-date changes without the two fighting
each other. Tested first with the unit tests above, before screens.

**Stop and ask.** Deleting a split or plan that a schedule or past session
uses: propose the behaviour instead of choosing silently. A rescheduling case
the rules above don't decide (e.g. moving a day earlier, or into a date that
already has a hand-made change): propose, don't guess.

**Decided by Taylor, 2026-11-18 (after review).** Deleting a split also removes
its schedules, after a warning naming the dates, with Undo. Deleting a plan
removes it from split days and dates; a date set to only that plan goes back to
the split; logged sets are kept. Moving a day earlier is supported (both
modes). With "all future", moved hand-made changes replace any already on
the destination dates, and days left behind when moving later become rest.
"Update the plan everywhere" asks for confirmation because it cannot be undone.
