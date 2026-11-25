# W-17: Logging as it really happened

Status: approved by Taylor 2026-11-24 ("approve all of those defaults and builds"), with every default answer.
Cleared to run unattended: yes
Satisfies: R-05.11, R-05.12 (new), R-05.9 (changed)

## Goal

A workout rarely goes exactly as planned: a machine is taken, so you do
something else first. The log should record the order you actually did things
in, without changing the plan. A finished exercise should take up less space,
and the screen should have no buttons you don't need.

## Done when

- *As-run order (R-05.11).* During a workout every exercise card has
  **Move up** and **Move down**. The new order is saved on that workout only:
  the plan, the split and later workouts keep the planned order. The finished
  workout's day card and the history list its exercises in the order they were
  done. Reopening a finished workout shows its as-run order. — test,
  demonstration
- *Folding finished exercises (R-05.12).* When an exercise's last target set
  is logged, its card folds to one line: name, sets done and the best set
  ("Bench press · 3 sets · best 185 lb × 8"). Tap the line to open it again;
  tap the header to fold it. An exercise with extra sets logged beyond the
  target still folds. Folding is only on screen; nothing is lost. — test,
  demonstration
- *No Rep change button (R-05.9 changed).* The Rep change button is removed.
  You change reps by editing the set's reps, as you do today. Weight change
  and Failed stay. Sets already logged with a rep change still read
  correctly. — test
- *Backup.* W-07's export and restore keep the as-run order. — test
- Controls are at least 44 × 44 points; phone-size screenshots of a moved
  card, a folded card and the change-button row. — demonstration
- The project's check command passes: `npm run check`

**Data shape.** `Session` gains `slotOrder`: the plan slot ids in the order
done (empty = the plan's order). Sets still key on `exerciseId`, so history
and PRs don't change.

## Out of scope

Reordering by drag and drop (Move up/down is easier to hit with sweaty
hands); changing the plan from the logging screen; reordering warm-up moves
during a workout.

## Riskiest assumption

That Move up/down is enough. With 8 exercises, moving the last one to the top
is 7 taps. Answer 1 below is the alternative.

## Slices

1. `slotOrder`, its upgrade and functions with tests; Rep change removed.
2. Move buttons, folding, day card and history order.
3. Screenshots, `npm run check`, review.

## Stop and ask if

- A requirement looks wrong, or a test looks wrong.
- The same failure happens twice.

## Acceptance script

1. Start a workout with at least four exercises. Log one set of the third
   exercise first, then move it to the top.
2. Finish all sets of one exercise: it folds to one line. Tap it: it opens.
3. Check there is no Rep change button and that typing new reps still works.
4. Finish, open the day card: the order is the one you did. Open the plan:
   its order is unchanged. Next week's workout uses the plan's order.

## Answers (Taylor approved the defaults 2026-11-24)

1. Should the order also update by itself, putting each exercise where you
   logged its first set? Default: **no**, only Move up/down, so cards never
   jump while you're looking at them.
2. Fold automatically when the target sets are done, or only when you tap?
   Default: **automatically**.

**As built (2026-11-24, after review):** a finished exercise folds when a set of it is rated or when a set is logged in another exercise, whichever comes first, and when the workout is opened with it already finished. It does not fold the instant its last set is logged, because that would hide the one-tap difficulty picker for that set (R-05.6). Taylor can ask for the instant fold instead.
