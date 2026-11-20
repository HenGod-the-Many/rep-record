# W-08: Exercise history, PRs, estimated 1-rep max and chart

Status: approved 2026-11-20 by Claude on Taylor's say-so (Taylor delegated release-2 spec approval); reviewed by acceptance-reviewer, fixes made. Taylor can overrule any answer under "Answers".
Cleared to run unattended: yes
Satisfies: R-06.1 to R-06.4, and the history parts of R-05.6 and R-05.7

## Goal

Taylor decides when to add weight by looking at what was lifted last time and
how hard it felt. History is that record: every set of an exercise in one
place, whichever plan or split it was done in, with the records and a chart
that show whether it is going up.

## Done when

- *One list per exercise (R-06.1).* Each exercise has a History screen,
  reached from the exercise in the Exercises tab and from a "History" link on
  its card in the logging screen. It lists every logged set of that exercise,
  newest session first, grouped by date: weight × reps for each part,
  difficulty and the "to failure" mark. It reads sets by `SetLog.exerciseId`
  only, so sets from any plan, a session-only swap, or a workout built from
  scratch all appear. Archived exercises keep their history. — test
- *Parts and difficulty (R-05.6, R-05.7).* A set with a weight change shows
  each part ("5 × 135, 3 × 115 lb"). Difficulty shows next to its set
  ("8/10"). — test, demonstration
- *Records (R-06.2).* A records panel at the top: heaviest weight lifted for
  at least one rep, and best estimated 1-rep max, each with its date. Each
  part of a set counts on its own at its own weight. Bodyweight exercises show
  most reps in one set (and heaviest added weight if any); timed exercises
  show longest hold. — test
- *Estimated 1-rep max (R-06.3).* Epley: weight × (1 + reps ÷ 30), using only
  parts of 1 to 12 reps (1 rep = the weight itself). Parts of 13 or more reps
  are left out of the estimate but still listed. Worked numbers: 225 × 5 =
  262.5; 135 × 1 = 135; 100 × 13 is left out. — test with worked numbers
- *Chart (R-06.4).* Under the records, a chart with one point per date
  (two workouts on one date make one point): heaviest weight that date and
  best estimated 1-rep max that date, two lines,
  dates along the bottom. It fits 390 points wide, is drawn without a new
  library, and follows the lb/kg setting. It shows the last 3 months, with
  an "All" button for everything. With one session it shows one
  point; with none it says "No sets logged yet". — test of the numbers,
  demonstration of the drawing
- *Units.* Everything follows the lb/kg setting; stored pounds are never
  changed. — test
- *Speed.* With 2 years of data (about 300 sessions of an exercise) the
  screen opens in under a second on a desktop browser at phone size. — test
  with generated data
- Controls are at least 44 × 44 points; phone-size screenshots of the history
  list, records and chart. — demonstration
- The project's check command passes: `npm run check`

## Out of scope

The Stats screen and "recent PRs" across exercises (W-12). A "new PR!"
celebration in the logging screen. Volume charts, rep-range PRs (best 5-rep,
best 10-rep), comparing exercises. Editing sets from the history screen (they
are edited in the workout).

## Decisions already made

- History follows the exercise: queries key on `SetLog.exerciseId`, never on
  a plan or split (`CLAUDE.md`).
- Set shape with parts and difficulty ([decision 0003](../decisions/0003-set-shape-parts-and-difficulty.md)).
- No new dependency for the chart: a small hand-drawn SVG.

## Riskiest assumption

That a hand-drawn SVG chart reads well at 390 points wide with two lines and a
year of points. Check first with generated data on the real screen at
390 × 844 and a screenshot; thin the date labels as needed.

## Slices

1. Data functions with tests: history for an exercise, records, Epley with
   the 12-rep cap, per-session chart points, generated-data speed test.
2. History screen with list and records; links from Exercises and from the
   logging card.
3. Chart.
4. Screenshots, `npm run check`, review.

## Stop and ask if

- A requirement looks wrong, or a test looks wrong.
- A new dependency seems necessary.
- The same failure happens twice.

## Acceptance script

Release 2 steps 1 to 3 in [verification-plan.md](../verification-plan.md):

1. Log Bench press from two different plans; open its history. Both sessions'
   sets are in one list with dates and difficulty.
2. Do a weight change in one set (135 → 115 at rep 6). History shows both
   parts.
3. The records panel shows heaviest weight and best estimated 1-rep max.
4. The chart shows one point per session.

## Answers (decided 2026-11-20 under Taylor's delegation; Taylor can overrule)

1. Records are heaviest weight and best estimated 1-rep max for now; best
   weight for a given rep count can come later.
2. The chart shows the last 3 months, with an "All" button.
3. One rep counts as the weight itself (plain Epley would add about 3 %), so a
   true single is its own 1-rep max.
