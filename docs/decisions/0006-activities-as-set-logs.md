# 0006: Activities stored as set logs

Date: 2026-11-22 · Item: W-15 · Status: decided (Claude, under Taylor's delegation for release 2)

## Context

Runs, rides and other activities need to sit in the same plans, splits,
calendar, history and backups as lifting (R-13.1, R-13.5), and history must
keep following the exercise (`SetLog.exerciseId`).

## Decision

- An activity is an exercise of kind `activity`, with `hasDistance` and a
  `met` value. Seven built-ins (run, walk, bike, hike, swim, row, elliptical)
  have fixed ids and are added by the first-launch seed and the version-6
  upgrade; an existing exercise with the same name is left alone.
- A logged activity is one `SetLog` with one part: the duration is
  `parts[0].seconds`, effort is `difficulty`, and new optional fields hold
  `distanceMi`, `avgHr` and typed `calories`. Distance is stored in miles at
  full precision; km is display only.
- In a plan, an activity's target minutes use `repMin`/`repMax` (the same way
  timed exercises keep seconds there), with `targetSets` = 1, plus an optional
  `targetDistanceMi`.
- Calories are never stored as an estimate. When none were typed, the screen
  works one out from MET × kg × hours using the bodyweight on or before the
  activity's date, so a later weigh-in doesn't change past rides.
- Activities are left out of lifting sets, volume and PRs.

## Rejected

- **A separate activities table:** history, swaps, plans, backup and
  pre-fill would each need a second code path.
- **Storing estimated calories:** the number would go stale if a bodyweight
  entry for that date was added or corrected later.
- **New `targetMinutes` field on plan entries:** the spec suggested it, but
  `repMin`/`repMax` already carry timed targets, and reusing them keeps the
  plan screens and copies working without changes.
