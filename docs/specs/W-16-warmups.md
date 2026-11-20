# W-16: Warm-up routines

Status: draft 2026-11-20, awaiting Taylor's approval (questions at the end)
Cleared to run unattended: not yet
Satisfies: R-14.1, R-14.2

## Goal

A warm-up is easy to skip when it lives in your head. Attached to a plan, it
comes up first when the workout starts and each move is one tap to tick off.

## Done when

- *Build routines (R-14.1).* Plans tab → **Warm-ups**: create, rename,
  delete a routine. A routine is an ordered list of moves; each move has a
  name and either reps ("10 arm circles") or a time ("2 min jump rope").
  Moves can be added, edited, reordered (up/down) and removed. Moves are
  plain text, not library exercises, so warm-ups never appear in history or
  PRs. — test
- *Attach to a plan (R-14.2).* A plan has a "Warm-up" choice (none or a
  routine). One routine can be attached to many plans. Deleting a routine
  detaches it from its plans after a confirm that names them. — test
- *Shown first (R-14.2).* Starting a workout whose plan has a warm-up shows a
  Warm-up card above the exercises: each move with a ✓, one tap to check it
  off, tap again to undo. Checks are saved at once and survive closing the
  app. When every move is checked the card folds to "Warm-up done". The
  warm-up never blocks logging sets. — test, demonstration
- *Timed moves.* A timed move shows its time; no countdown timer. — test
- *Backup.* W-07's export and restore include routines and checks. — test
- Controls are at least 44 × 44 points; phone-size screenshots of the
  routine editor and the warm-up card. — demonstration
- The project's check command passes: `npm run check`

**Data shape** (next database version). `warmups`: id, name, moves (list of
`{ name, reps or seconds }`). `Plan` gains `warmupId` (or null). `Session`
gains `warmupChecked` (list of move positions checked) and a copy of the
moves at start, so editing a routine later doesn't change past workouts.

## Out of scope

Countdown timers, cool-downs, warm-up sets of the lift itself (out of scope in
the requirements), suggested warm-ups, warm-ups on days with no plan.

## Decisions already made

- Warm-up routines are in scope since 2026-11-18 (KF-14); warm-up sets and
  rest timers are not.

## Riskiest assumption

That another card above the exercises keeps the logging screen fast to use.
Folded "Warm-up done" takes one line; check at 390 × 844 that the first
exercise's first set is still on screen without scrolling when the warm-up is
done.

## Slices

1. Data shape, upgrade; functions with tests (routines, moves, attach, detach
   on delete, checks, copy at start).
2. Warm-ups screen and the plan's Warm-up choice.
3. Warm-up card in the logging screen.
4. Screenshots, `npm run check`, review.

## Stop and ask if

- A requirement looks wrong, or a test looks wrong.
- The same failure happens twice.

## Acceptance script

Release 2 step 11 in [verification-plan.md](../verification-plan.md).

## Questions for Taylor

1. Warm-up moves are plain text (not exercises from the library), so they
   stay out of history. OK?
2. Should a timed move have a simple countdown you can start, or is showing
   the time enough for now?
