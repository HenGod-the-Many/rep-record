# W-05 Splits, schedules, date overrides and Today

**What it is for.** Taylor can set up the weekly split, put it on the calendar
for a stretch of time, change a single day when life gets in the way, and open
the app to see what today's workout is.

**Done when.**
- *Splits (R-03.1, R-03.2).* A Splits screen lists splits. A split has a name
  and a cycle length, entered in days or weeks (stored as days). Each day of the
  cycle is a plan or Rest, picked from a list. You can create, edit, duplicate
  and delete a split. The seeded 7-day default split is there on first launch.
- *Schedules (R-03.3, R-03.5).* From a split, "Schedule" asks for a start date
  and a length in days or weeks. Every date in that range gets the split's day
  for `(date − start) mod cycle`; dates outside any schedule show nothing.
  Where two schedules cover the same date, the most recently created one wins.
  Schedules can be listed and deleted.
- *Calendar.* A month view shows each date's plan name or "Rest", marks
  overridden dates, and moves month to month.
- *Overrides (R-04.1).* Tapping a date lets you pick a different plan or Rest
  for that date only, or clear the override. The split and schedule are
  unchanged.
- *Today (R-03.4).* The home screen shows today's date and planned workout
  (or Rest, or "Nothing scheduled") with its exercises and targets. A missed
  day does not shift later days: what a date shows depends only on the
  calendar, never on what was logged. The "Start workout" button is shown but
  logging itself is W-06.
- Dates are local calendar dates (`YYYY-MM-DD`), so a daylight-saving change or
  a time zone change can never move a workout to another day.
- Unit tests cover: cycle maths across a cycle boundary and a month/year
  boundary, start and end of a schedule's range (inclusive start, exclusive
  end), overlapping schedules, an override beating a schedule, clearing an
  override, a DST-change week, and a missed day not shifting later days.
- Phone-size (390 × 844) screenshots of Splits, split editor, Schedule,
  Calendar, Override and Today; every control at least 44 × 44 points.

**Out of scope.** Logging sets (W-06), session history, notifications or
reminders, recurring overrides.

**Riskiest assumption.** Date maths stays correct across DST and month ends
when using plain local date strings. Tested first with the unit tests above,
before building screens.

**Stop and ask.** Deleting a split or plan that a schedule or past session
uses: propose the behaviour (block, or keep past sessions by name) instead of
choosing silently if the requirements don't already decide it. Any change to
the stored data shape that would need migrating existing data.
