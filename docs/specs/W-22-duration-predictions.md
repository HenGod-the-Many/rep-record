# W-22: Duration predictions

Status: approved by Taylor 2026-11-28 ("Approve defaults"): all six default answers
Cleared to run unattended: yes, once approved (every line below can be shown by a test, a screenshot or the report script; nothing is left to assume once the answers are approved)
Satisfies: KF-17, R-17.7–R-17.11 (new)

## Goal

Know before starting how long a workout, a single exercise and a program's
week will take, from your own pace. Taylor pocketed this on 2026-11-25; W-25
(v0.10.0) now measures every set, exercise and workout, so predictions can be
built from real numbers. Unlike W-25's "about N min" (the average of the last 5
times a workout was done), a prediction follows the workout as it is now: add
an exercise or a set and the time changes.

What the logged workouts already show: about half of a workout is time between
exercises (walking over, setting up, the first rest). On Push (24 Nov) and Pull
(25 Nov) it was about 4½ minutes per exercise both times. So a prediction has
three parts: set-up before the first set, each exercise's own time, and the
time between exercises.

## Done when

- *R-17.7 Exercise prediction.* Each exercise in a workout gets a predicted
  time: its target sets × its own average time per set (from the last 5 workouts
  it was done in; history follows the exercise). An exercise never done uses a
  starting estimate (answer 2). — test
- *R-17.8 Workout prediction.* A workout's predicted time is set-up + its
  exercises' predictions + the time between exercises, each from your last 5
  workouts (answer 3 for defaults). Supersets and circuits count their rounds,
  and the change between their exercises counts as set time, not time between
  exercises. — test (known answers: straight sets, a superset, a never-done
  exercise, no history at all)
- *R-17.9 Where it shows.* The workout screen shows "Predicted about N min"
  with each exercise's time; Home's workout card and the Library's workout rows
  show "about N min" from the prediction (answer 4); the workout screen also
  shows "Usually took about N min" (W-25's average) when it has been done.
  Editing the workout (add an exercise, change sets) changes the prediction at
  once. — test, demonstration
- *R-17.10 Program prediction.* A program shows each day's predicted time and
  the total for one cycle ("about 4 h 40 min a week"). — test, demonstration
- *R-17.11 Time left.* During a workout, under the timer: "about N min left",
  from the sets not yet ticked (answer 5). — test, demonstration
- *Accuracy check.* `node scripts/timing-report.mjs <backup> --predict` prints,
  for each logged workout, what the model would have predicted from the other
  workouts, next to what it took. — analysis (Taylor's backup; Taylor judges)
- `npm run check` passes; every existing test passes unchanged.

## Out of scope

Changing how W-25 measures time; progression predictions (W-21); alerts or
rest timers; predicting activities (a planned activity counts its target minutes,
nothing more); learning beyond a plain average (no trends, no time of day).

## Decisions already made

W-25 spec and its answers 1–12 (3 s per rep, 5 min per set, 15 min between
ticks, last 5); `src/db/timing.ts` and `src/db/averages.ts` are the base.
History follows the exercise (`CLAUDE.md`).

## Riskiest assumption

That an average of a few workouts predicts the next one well enough to be
useful. Taylor has 2 timed workouts so far (3 by the time this is built). Slice
1 runs the model over the backup, predicting each workout from the others, and
reports the gap before any screen is built. A gap over 25% on a normal workout
(not one with a forgotten tick) is a stop-and-ask.

## Slice 1 result (2026-11-28, Taylor's backup of 2026-11-27)

`node scripts/timing-report.mjs <backup> --predict`, each workout predicted from
the other one only:

- Push (24 Nov): predicted 76:41, took 69:14 (+11%; this workout had a forgotten tick).
- Pull (25 Nov): predicted 87:22, took 60:52 (**+44%**: over the 25% stop line).

Why: Pull shares none of its 7 exercises with Push, the only other timed
workout, so every exercise used the never-done estimate (2½ min per set; Pull's
real pace was 1:18). Using Taylor's own Push average per set instead (2:17)
still gives 80:32 (+32%): Push is slower work than Pull. With one other workout
and no shared exercises, no average predicts Pull well. The model can only be
judged when a workout is predicted from earlier runs of the same workout.
Stopped and asked Taylor.

## Slices

1. **Prediction model** (tests first): per-exercise time per set, set-up, time
   between exercises, workout and program totals, time left. Add `--predict` to
   the report script; run it on Taylor's latest backup; record the result here.
2. **Workout screen, Home, Library:** predicted time and per-exercise times.
3. **Program screen:** per day and per cycle.
4. **Time left** under the timer while logging.
5. **Finish:** both-mode screenshots, review, release on Taylor's OK.

## Stop and ask if

- Slice 1's predictions miss a normal workout by more than 25%.
- A slice would change W-25's measured times or how logging behaves.
- A requirement or a test looks wrong; the same failure happens twice; a new
  dependency is needed.

## Acceptance script

1. Open a workout you have done: it says "Predicted about N min" and each
   exercise has a time. Do they look like your real pace?
2. Add a set to one exercise: the total goes up by about one set.
3. Open your program: each day has a time, and the week has a total.
4. Start the workout: under the timer it says "about N min left", and it
   drops as you tick sets.
5. After the workout, compare the prediction with the timer's time.

## Answers (defaults in bold; Taylor to approve or change)

1. Averages over **the last 5 times**, as in W-25.
2. An exercise never done: **its target sets × (reps × 3 s + 2 min rest)**, then
   your own pace once it has been done once.
3. With no history at all: **set-up 5 min, 3 min between exercises**; replaced by
   your own numbers after the first timed workout.
4. Home and Library: **"about N min" becomes the prediction** (it follows your
   edits). The average of the actual times stays on each workout's screen as
   "Usually took about N min", so nothing W-25 shows is lost.
5. Time left during a workout: **yes**, under the timer.
6. A program's total: **per cycle** (a week for a 7-day program), plus each day.
