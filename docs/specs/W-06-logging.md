# W-06: Logging screen

Status: draft
Cleared to run unattended: no, because Taylor has not approved this page or the three assumptions at the bottom
Satisfies: R-04.3, R-05.1 to R-05.8

## Goal

Taylor logs every set at the gym, between sets, on the iPhone. Logging has to
be faster than a notes app or it won't get used, so a set that went as planned
is one tap. Every set carries a 1–10 difficulty because that number is
Taylor's main sign of being ready to add weight, so it must be one tap too.

## Done when

- *Start (R-05.1).* On Today, "Start workout" is enabled for each of today's
  workouts and opens the logging screen. Starting the same workout again that
  day resumes it instead of making a second session. A finished workout shows
  as done on Today, with a way to reopen it. — test, demonstration
- *Pre-fill (R-05.2).* Each exercise shows as many set rows as the plan's
  target sets. Row *n* is pre-filled from set *n* of the most recent earlier
  session in which that exercise was logged, in any plan (query on
  `SetLog.exerciseId`; if last time had fewer sets, use its last set). The
  first time, rows are empty with the target reps shown as a hint. — test
- *One tap (R-05.3, R-05.5).* Tapping a pre-filled row's check button logs it
  and writes it to the database at once; closing or reloading the app
  mid-workout loses nothing. Weight and reps can be changed with ± buttons
  (5 lb / 2.5 kg, 1 rep, 5 s) or by typing, before or after logging. "+ Set"
  adds a row; a logged set can be edited or deleted. — test; reload shown in
  the browser
- *Kinds (R-05.1).* Weight exercises log weight × reps; bodyweight logs reps
  with optional added weight; timed logs seconds. — test
- *Difficulty (R-05.6).* Logging a set shows a 1–10 picker on it; one tap
  sets the difficulty, and it can be changed or left blank. Each pre-filled row
  also shows last time's difficulty for that set ("last: 8"). The new
  difficulty is never copied from last time. — test, demonstration
- *Weight change in a set (R-05.7).* "Weight change" on a row adds a second
  part pre-filled with the same weight; Taylor adjusts its weight and reps
  (e.g. 5 × 135 then 3 × 115). A set may have several parts. Each part is
  stored at its own weight, so W-08's history and PRs can count them
  separately. — test
- *Session-only swap (R-04.3).* "Swap" on an exercise offers that slot's
  alternates first, then the whole active library. The substitute's sets are
  saved under the substitute's `exerciseId` (pre-filled from its own history)
  with the plan slot recorded; the plan is unchanged. Sets already logged for
  the original stay logged under it. — test
- *Units (R-05.4).* Settings has lb / kg. Weights are stored in pounds at full
  precision; kg is display and entry only. Switching back and forth changes no
  stored value; a weight typed in kg reads back the same in kg. — test
- *Speed (R-05.8, R-05.3).* A tap-count table in the PR: log a pre-filled set
  = 1 tap; set difficulty = 1 tap; record a weight change = at most 4 taps
  when the second part is within a few ± steps. Every control is at least
  44 × 44 points. — demonstration with 390 × 844 screenshots, inspection
- The project's check command passes: `npm run check`

**Data shape** (database version 3, with an upgrade that moves any existing
values across). `SetLog` gains `difficulty` (1–10 or null) and `parts`, a list
of `{ weightLb, reps, seconds }`, at least one; the single weight/reps/seconds
fields move into the first part. `Session` gains the workout `time` (so two
workouts on one day stay apart), `startedAt`, `finishedAt` (null while open)
and `swaps` (plan slot → substitute exercise), so a swap survives closing the
app before any set is logged. The units setting lives in `settings`.

## Out of scope

Activities and warm-ups (W-15, W-16, release 2). History screen, PRs, 1RM and
charts (W-08; this item only stores sets so W-08 can read them). Journal and
session notes (W-09). Export and import (W-07). Rest timer, plate maths,
supersets, logging workouts for past dates, editing the plan from the logging
screen (the plan is changed only in the plan builder).

## Decisions already made

- `CLAUDE.md` rules: history keys on `SetLog.exerciseId`; exercises are never
  deleted; weights stored in pounds. [Decision 0001](../decisions/0001-stack-and-storage.md) (Dexie, IndexedDB).
- To be recorded: decision 0003, the set shape with parts and difficulty. It is
  expensive to change later because export (W-07) and PRs (W-08) build on it.

## Riskiest assumption

That one set row, a 1–10 picker and the weight-change control fit a 390-point
wide phone screen with 44-point targets while keeping each action to the tap
counts above. Ten 44-point buttons need 440 points, more than the screen is
wide, so the picker likely needs two rows of five or a pop-up strip. Spike
first: a throwaway static page at 390 × 844 with one exercise card, screenshot
it, record the chosen layout here, then build.

## Slices

1. Spike: the layout page above. Record the result in this spec.
2. Data: version 3 shape and upgrade, decision 0003, and data functions with
   unit tests (start/resume, pre-fill, log, edit, delete, parts, difficulty,
   swap, finish, unit conversion).
3. Units setting in Settings and shared weight formatting.
4. Logging screen, and Start/Resume/done on Today.
5. Screenshots, tap-count table, `npm run check`, review.

## Stop and ask if

- The spike shows the tap counts or 44-point targets can't both be met.
- A requirement looks wrong, or a test looks wrong.
- A new dependency or a secret is needed.
- The same failure happens twice.
- A case the rules above don't decide, such as a plan edited or deleted while
  its workout is open: propose, don't guess.

## Acceptance script

Release 1 steps 3 to 7 and 14 in [verification-plan.md](../verification-plan.md), on the iPhone after the next release:

1. Start today's workout: sets pre-fill (empty the first time).
2. Log Bench press 3 sets with one tap each; swap Machine fly for Cable fly for
   this session and log a set; the Push plan still lists Machine fly.
3. Close the app mid-workout and reopen: the sets are still there.
4. Next time Bench press comes up, in any plan, it pre-fills last time's
   weights and reps.
5. Switch to kg and back: weights show in kg, then the original lb values.
6. Log a set with difficulty 8, then a set of 5 × 135 then 3 × 115. Each takes
   a few seconds. Next session the pre-fill shows "last: 8".

## Assumptions to confirm

1. Difficulty scale: 10 = couldn't do another rep, 1 = very easy. The app
   shows just the number, no labels.
2. ± steps of 5 lb (2.5 kg), 1 rep and 5 seconds.
3. Logging is for today only; logging a missed workout on a past date waits
   for a later item.
