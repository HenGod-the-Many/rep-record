# 0003 A logged set is a list of parts, plus difficulty and a failure mark

Status: Decided in W-06 (spec approved by Taylor 2026-11-18), recorded 2026-11-19.

## Context

Taylor changes weight partway through a set (8 reps planned at 135 lb, drops to
115 lb at rep 6), rates every set 1–10, and sometimes goes to failure. History,
PRs (W-08) and export (W-07) will all read logged sets, so the shape is
expensive to change once data builds up on the phone.

## Decision

- A `SetLog` holds `parts`: one or more `{ weightLb, reps, seconds }`, in the
  order they happened. A plain set has one part; 5 × 135 then 3 × 115 is two.
- `difficulty` is 1–10 or null; `toFailure` is true or false.
- Weights stay in pounds at full precision (the project rule); kg is display
  and entry only.
- A `Session` carries its workout `time`, `startedAt`, `finishedAt` (null while
  open) and `swaps` (plan slot → substitute exercise), so two workouts on one
  day stay apart and a swap survives closing the app.
- Database version 3 moves old single-value sets into one part, and treats
  sessions saved before version 3 as finished.

## Rejected

- **One SetLog per part** (two rows for one set): the set number, difficulty
  and failure mark would be repeated or split across rows, and "how many sets"
  would need grouping everywhere.
- **Recording only the final weight with a note**: W-08 couldn't count each
  part at its own weight, which R-05.7 requires.
- **Storing kg values when the setting is kg**: two units in one column makes
  every history query convert, and switching back and forth could drift.
