# W-15: Activities: runs, rides, hikes, swims and your own

Status: approved 2026-11-20 by Claude on Taylor's say-so (Taylor delegated release-2 spec approval); reviewed by acceptance-reviewer, fixes made. Taylor can overrule any answer under "Answers".
Cleared to run unattended: yes
Satisfies: R-13.1 to R-13.5

## Goal

The app is not only for lifting. A bike ride or a hike belongs in the same
plans, calendar and history as a bench press, logged in seconds, with a
calorie number even when no watch supplied one.

## Done when

- *Activities are exercises (R-13.1).* A new exercise kind, **activity**.
  Built in: run, walk, bike, hike, swim, row (with distance) and elliptical
  (no distance). If an exercise with one of those names already exists, it is
  left as it is and no duplicate is added. **New exercise**
  can make your own activity (such as "Rock climbing"), with a "has distance"
  switch. Activities are archived like any exercise, never deleted. — test
- *In plans and splits (R-13.5).* An activity can be added to a plan like
  any exercise, with a target duration and, if it has distance, a target
  distance ("Bike ride 45 min, 12 mi"). So a split day can be just a ride. —
  test
- *Logging (R-13.2, R-13.3).* In the logging screen an activity's card has
  one row instead of sets: duration (minutes, ± 5 min or typed), distance
  (miles or km by the unit setting, ± 0.5 or typed; hidden for activities
  without distance), and a ✓ to log. Optional, folded under "More": effort
  1–10 (the same one-tap picker as set difficulty), average heart rate, and
  calories typed by hand. Pre-fill comes from the last time that activity was
  logged, by `exerciseId`, like sets. — test, demonstration
- *Estimated calories (R-13.4).* If calories are left blank, the app shows
  MET × bodyweight in kg × hours, using the latest bodyweight entry (W-11),
  rounded to the nearest 5 and labelled "≈ 410 kcal (estimate)". The
  bodyweight used is the latest entry on or before the activity's date, so a
  later weigh-in doesn't change past rides. MET values
  built in: walk 3.5, hike 6.0, bike 7.5, run 9.8, swim 7.0, row 7.0,
  elliptical 5.0; a custom activity asks for one (default 5.0) and can be
  changed. With no bodyweight entered it says "Enter your bodyweight to
  estimate calories" and links to it. Typed calories always win and are never
  labelled an estimate. Worked example in the tests: 30 min bike at 180 lb
  (81.6 kg) = 7.5 × 81.6 × 0.5 = 306 → 305 kcal. — test
- *Not sets.* Activities are left out of W-12's "Sets this week" and volume
  cards, and out of lifting records. — test
- *Units.* Distance is stored in miles at full precision; km is display only,
  like weights. — test
- *History.* An activity's history (W-08's screen) lists date, duration,
  distance, pace or speed, effort and calories, and its records are longest
  distance and longest duration. — test
- *Backup.* W-07's export and restore include activity logs. — test
- Controls are at least 44 × 44 points; phone-size screenshots of an
  activity card while logging and the activity history. — demonstration
- The project's check command passes: `npm run check`

**Data shape** (database version 6, after W-16's version 5). `ExerciseKind` gains `activity`;
`Exercise` gains `hasDistance` and `met`. `PlanExercise` gains optional
`targetMinutes` and `targetDistanceMi`. Activity logs are `SetLog` rows with
one part; duration goes in that part's existing `seconds` (no new duration
field). New optional fields on the row: `distanceMi`, `avgHr`, `calories`;
effort uses the existing `difficulty`. The seven built-in activities are
added both by the first-launch seed and by the upgrade; a test opens a
brand-new database and finds them.

## Out of scope

GPS tracking or maps, importing from Strava or Apple Health (W-13), heart-rate
zones, splits per lap or mile, calorie goals or nutrition.

## Decisions already made

- History follows the exercise (`CLAUDE.md`); activities use the same
  `exerciseId` history.
- Set shape with parts and difficulty ([decision 0003](../decisions/0003-set-shape-parts-and-difficulty.md)).
- To be recorded: decision 0006, activities stored as set logs with extra
  fields rather than a separate table, and the MET table.

## Riskiest assumption

That adding a fourth exercise kind doesn't break the screens and functions
that assume weight, bodyweight or timed (pre-fill, change buttons, swaps,
history). Before building, list every place that switches on `kind` (a code
search) and add a test for each that runs with an activity.

## Slices

1. Data shape, upgrade, decision 0006; functions with tests (kind, targets,
   logging, pre-fill, calories with the worked example, units).
2. Exercise form and plan entry for activities.
3. Activity card in the logging screen.
4. Activity history and records (with W-08).
5. Screenshots, `npm run check`, review.

## Stop and ask if

- The code search finds kind-based logic that can't take a fourth kind
  without changing W-06's behaviour.
- A requirement looks wrong, or a test looks wrong.
- The same failure happens twice.

## Acceptance script

Release 2 step 10 in [verification-plan.md](../verification-plan.md).

## Answers (decided 2026-11-20 under Taylor's delegation; Taylor can overrule)

1. The MET values above are the defaults (standard moderate-effort values);
   each activity's MET can be changed.
2. Distance ± steps 0.5 mi / 0.5 km, and it can be typed.
