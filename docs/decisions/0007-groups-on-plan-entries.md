# 0007: Supersets and circuits are stored on the plan entries

Date: 2026-11-24 (W-19)

## Context

W-19 adds supersets and circuits: two or more exercises in a row in a plan,
done round by round for a number of rounds. The spec suggested a new
`planGroups` table, to be confirmed here. Plans are copied in four places
(duplicate a plan, duplicate a folder, a one-date copy, "update everywhere"),
and each copies entries with their fields.

## Decision

A group lives on its member entries: `PlanExercise` gains `groupKey` (shared
by the members, unique within the plan), `groupKind` (`superset` or
`circuit`) and `groupRounds`. Members are consecutive in the plan. Every
member's `targetSets` equals the rounds (Taylor's answer: every exercise does
every round), so a set logged in round 3 is an ordinary `SetLog` with set
number 3, and history, PRs and pre-fill need no change. Warm-ups gain an
optional `rounds`; a workout keeps its own copy (`warmupRounds`).

No new table or index, so the database stays at version 7.

## Rejected

- **A `planGroups` table** (the spec's suggestion): every place that copies a
  plan would have to copy and re-key its groups, and a missed one would leave
  two plans sharing a group. Storing the group on the entries makes every
  existing copy carry it correctly with no extra code.
- **Sets that remember their round**: not needed while set number = round.
- **Different set counts per member**: ruled out by Taylor's answer 2.

## Consequences

Kind and rounds are repeated on each member; only the functions in
`src/db/groups.ts` change them, and they change all members together.
Reordering keeps groups whole: a grouped entry moves only within its group,
and an ungrouped entry next to a group jumps over the whole group.
