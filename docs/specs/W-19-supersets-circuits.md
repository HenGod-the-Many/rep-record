# W-19: Supersets and circuits

Status: approved by Taylor 2026-11-24 ("approve all of those defaults and builds"), with every default answer.
Cleared to run unattended: yes
Satisfies: KF-15, R-15.1 to R-15.4 (new)

## Goal

Much of real training is done in groups: a superset of two or three
exercises done back to back and then repeated, a kettlebell or calisthenics
circuit done for several rounds, a warm-up done twice through. Plans,
warm-ups and the logging screen should handle these groups.

## Done when

- *Groups in plans (R-15.1).* In a plan you can put two or more exercises in
  a row into a group, give it a kind (**Superset** or **Circuit**) and a number
  of rounds, and take exercises out of it again. Each exercise in a group
  keeps its own target reps or time and weight. The plan shows the group as
  one block ("Superset · 3 rounds: A1 Bench press, A2 Bent-over row").
  Duplicating a plan copies its groups. — test, demonstration
- *Logging a group (R-15.2).* In a workout a group is one card that goes
  round by round: Round 1 lists each exercise with its pre-filled set, one tap
  each, then Round 2, and so on. Every set is still saved under its own
  exercise, so history, PRs and pre-fill work as for any other set. Weight
  change, Failed, difficulty and session-only swap work inside a group. The
  card folds when all rounds are done (as in W-17). — test, demonstration
- *Groups in warm-ups (R-15.3).* A warm-up routine can have rounds ("2 rounds:
  10 arm circles, 10 leg swings, 30 s jump rope"). The warm-up card checks off
  each move in each round. — test
- *Circuits from the library (R-15.4).* Exercises such as kettlebell swings,
  goblet squats, push-ups and pull-ups can be added to the library and used in
  a circuit; timed moves log seconds. — test
- *Backup.* W-07's export and restore include groups. — test
- Controls are at least 44 × 44 points; phone-size screenshots of a plan with
  a superset, a circuit in a workout mid-round and a warm-up with rounds.
  — demonstration
- The project's check command passes: `npm run check`

**Data shape** (to be confirmed by a decision record during slice 1). New
table `planGroups`: id, planId, kind (superset or circuit), rounds.
`PlanExercise` gains `groupId` (or null). A set logged in a group is an
ordinary `SetLog` whose set number is the round. Warm-ups gain `rounds`.

## Out of scope

Timers: rest timers, EMOM, AMRAP or interval clocks (they need a timer that
keeps running with the phone locked, which is its own piece of work). Groups
that are different from one round to the next. Grouping across two plans.

## Riskiest assumption

That logging round by round stays as fast as logging today: one tap per set
with nothing to scroll to. Test this first with a three-exercise superset at
390 × 844, before building the rest: the next set to do must be on screen
without scrolling.

## Slices

1. Decision record for the data shape; `planGroups`, upgrade, functions with
   tests (group, ungroup, duplicate, rounds; sets key on `exerciseId`).
2. Plan editor: make and edit groups.
3. Group card in the logging screen.
4. Rounds in warm-ups.
5. Screenshots, `npm run check`, review.

## Stop and ask if

- The riskiest assumption fails (the round view needs scrolling or extra taps).
- A requirement looks wrong, or a test looks wrong.
- The same failure happens twice.

## Acceptance script

1. In a plan, make a superset of two exercises with 3 rounds.
2. Start the workout and log all three rounds; each set is one tap.
3. Open each exercise's history: the sets are there under that exercise.
4. Build a kettlebell circuit of four moves (one timed) for 3 rounds and log it.
5. Give a warm-up 2 rounds and check off every move in both rounds.

## Answers (Taylor approved the defaults 2026-11-24)

1. Is a "circuit" anything more than a superset with more exercises (for
   example, done for time)? Default: **no difference except the name**;
   timed circuits wait for a timer item.
2. In a superset, may the exercises have different numbers of sets (bench 4
   rounds, row 3)? Default: **no, every exercise does every round**.
