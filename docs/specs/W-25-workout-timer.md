# W-25: Workout timer, exercise timing, and saving as you change

Status: draft, waiting for Taylor's approval (answers at the end have defaults).
Cleared to run unattended: yes, once approved
Satisfies: KF-17 (new), R-17.1–R-17.6 (new)

## Goal

Know how long workouts and single exercises really take, from the moment
Start workout is tapped to the last tick, and show it while training. This is
the measured base that duration predictions (W-22) will build on. Taylor asked
for this on 2026-11-25, while deciding how "minutes exercised" should count.
It also finishes approved answer 2 of W-20 (save as you change) on the screens
that still have a Save button, keeping a button only where it is clearly better.

What makes this cheaper than it sounds: every logged set already records the
moment its tick was tapped, and every workout records when Start was tapped.
So timing works for past workouts too, not only new ones.

## Done when

- *R-17.1 Timer on screen.* Tapping Start workout starts a timer, shown at the
  top of the logging screen (minutes and seconds, running). The user can pause
  and resume it; paused time is not counted. — test, demonstration
- *R-17.2 Timer stops by itself.* When the last target set of the last
  exercise is ticked, the timer stops and the workout's end time is that tick.
  If another set is then logged (an extra set, or an exercise added mid-workout),
  the timer runs on from that tick and the end time moves to the new last tick.
  Finish still closes the workout as today. — test, demonstration
- *R-17.3 Time per exercise, supersets included.* Each set is given the time
  since the previous tick in the workout (the first set of an exercise gets
  3 seconds per rep logged, counted back from its tick, when that is shorter).
  An exercise's time is the sum of its sets' times. So when sets of two
  exercises alternate (preacher curls between dumbbell shrugs), each exercise
  gets only the time before its own ticks, and the two add up to the workout.
  Exercises added mid-workout are handled the same way. — test (known answers
  for straight sets, an alternating superset, a circuit, an added exercise,
  a pause)
- *R-17.4 Averages.* An exercise's history shows its average time; a workout
  shows "about N min" (Home's workout card, the Library's workout rows), from
  the last 5 times each was done. — test, demonstration
- *R-17.5 Minutes exercised uses the timer.* Home's and Progress's minutes
  exercised become the timed duration of each workout (start to end, pauses
  taken out), replacing the rule chosen during W-20. An activity logged in a
  workout is inside its time; an activity-only workout that was never finished
  counts its logged activity time. — test
- *R-17.6 Save as you change.* Edit screens save as you change, except where
  the table below keeps a button; every screen in the table behaves as listed.
  — demonstration
- Logging is no slower: a set is still one tap; every existing test passes
  unchanged; `npm run check` passes.

**Saving: which screens change** (default answers; Taylor to approve)

| Screen | Now | Proposed | Why |
|---|---|---|---|
| Exercise edit (name, group, equipment) | Save | Save when a box is left | Plain edits; a duplicate name shows an error next to the box and keeps the old name |
| Exercise edit, "Measured as" | Save | Changes at once; asks first if the exercise has history | Changing it changes how past sets read: a big change, so it gets a confirm |
| Rename a workout, folder, program, warm-up, metric | Save | Saves when the box is left or Enter is pressed; Escape cancels | Small edits; no button needed |
| Superset / circuit kind and rounds | Save | Changes at once | Each change is small and easy to undo |
| A program's cycle length | Save | **Keeps Save** | Shortening deletes days: a big change that already asks first |
| Edit a body-metric entry (date and value) | Save | **Keeps Save** | Date and value are changed together; half an edit (new date on a taken day) is refused |
| Add a body-metric entry, quick bodyweight, new exercise, new workout, "Save as new workout" | Save / Create | **Keep their button** | These create something; a button says when it exists |

No screen needs a button for speed: every save is one small database write,
and typed boxes save 0.7 s after typing stops, or when the screen closes.

## Out of scope

Predictions of future durations (W-22 builds on these numbers); rest-timer
alerts between sets; timing warm-up moves one by one; changing what counts as
a set; drag-to-reorder.

## Riskiest assumption

That tick times give sensible exercise times. If Taylor rests on the phone
for 10 minutes, the next set would get 10 minutes. Answers 2 and 3 cap it;
the known-answer tests and Taylor's real workouts (which already have tick
times) will show whether the cap is right. Checked first, in slice 1, against
the workouts already in the app.

## Slices

1. **Timing model** (tests first): per-set time, exercise time, workout time
   with pauses, averages, minutes exercised. Run it over the workouts already
   logged and report what it gives before building screens.
2. **Timer on the logging screen:** running clock, pause and resume, stops at
   the last target set and runs on after an extra set. Pause times are stored
   with the workout (new optional fields; no database upgrade; backups carry
   them, and older backups still load).
3. **Showing it:** averages on exercise history, "about N min" on workouts
   (Home, Library), minutes exercised switched to the timer.
4. **Save as you change** on the screens in the table.
5. **Finish:** both-mode screenshots, review, then release together with W-20
   as v0.9.0 on Taylor's OK.

## Stop and ask if

- Slice 1 shows the per-set times look wrong on real workouts.
- A slice would change how logging behaves beyond adding the timer.
- A requirement or a test looks wrong; the same failure happens twice.

## Acceptance script

1. Start a workout: the timer appears at the top and runs.
2. Pause for a minute, resume: the minute is not counted.
3. Do two exercises alternating, set by set (as a superset or by hand).
4. Tick the last target set: the timer stops. Add an exercise, log a set: it
   runs on and stops again at that tick.
5. Open each exercise's history: it shows a time, and the two alternating
   exercises add up to roughly the time spent on them.
6. Home: the workout card says "about N min"; minutes exercised matches the
   timer.
7. Rename a workout: no Save button; leave the box and it is saved. Shorten a
   program's cycle: it still asks and has Save.

## Answers (defaults in bold; Taylor to approve or change)

1. Seconds per rep for the first set of an exercise (and timed sets use their
   own seconds): **3 seconds per rep**, as Taylor said.
2. Longest time one set can be given (phone put down, a chat between sets):
   **5 minutes**; more than that counts as 5.
3. Time before the first tick of the workout (warm-up, setting up): counted in
   **the workout's time but not in any exercise's** (except the first set's
   reps × 3 s).
4. When Finish is tapped well after the last tick (cool-down, stretching):
   the workout ends at **the last tick**, as Taylor said; Finish only closes
   it. A workout with no ticks ends at Finish.
5. Averages over **the last 5 times** an exercise or workout was done.
6. Past workouts (before the timer existed) **count**, using their existing
   tick times and start time; they just have no pauses.
7. Saving: **as in the table above**.
8. Release: **W-20 and W-25 together as v0.9.0**, so the minutes rule changes
   only once on the phone.
