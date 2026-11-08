# What Workout Journal has to do, and what proves it does

Status: draft. Written 2026-11-08 from Taylor's brief ("Workout Planner, Journal &
Log: Project Brief") and Taylor's answers in the first Claude Code session.
Awaiting Taylor's approval.

Four levels, each traceable to the next:

```
Key function (KF-nn)    what the user needs to do, in the owner's words
  Requirement (R-nn.n)  something checkable that would satisfy it
    Item                the work, from the queue (docs/queue.md)
      Evidence          tests, screenshots and merged pull requests
```

**Priority:** must, should, could or later. Must means the project is pointless
without it.

**Method:** Test (automated, fails if broken), Demonstration (run it; screenshot
or output), Inspection (read code/files against the requirement), Analysis
(measurement or reasoning against a threshold).

**Status:** `planned`, `in progress`, `built`, `verified` or `accepted`.
`verified` is written only from an independent reviewer's verdict. `accepted` is
written only by Taylor.

## The key functions, at a glance

| KF | The function, as the owner would say it | Priority | Release | Status |
|---|---|---|---|---|
| KF-01 | Keep a library of my exercises | must | 1 | planned |
| KF-02 | Build reusable workout plans | must | 1 | planned |
| KF-03 | Build a split that repeats on a cycle and schedule it on my calendar | must | 1 | planned |
| KF-04 | Swap a plan or an exercise when I need to | must | 1 | planned |
| KF-05 | Log every set quickly at the gym, pre-filled from last time | must | 1 | planned |
| KF-06 | See each exercise's whole history, PRs and progress | must | 2 | planned |
| KF-07 | Keep a journal per workout and per day | should | 2 | planned |
| KF-08 | Use it on my iPhone with bad gym wifi without losing my data | must | 1 | planned |
| KF-09 | See the training tips | could | 3 | planned |

---

## KF-01 Keep a library of my exercises

*Every exercise is a permanent "brick" that history hangs off.*

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-01.1 On first launch the library holds every exercise named in the brief's five plans, once each; "A or B" entries become two separate exercises | must | Test | W-01 | planned | |
| R-01.2 You can create and edit an exercise's name, muscle group, equipment and kind (weight × reps, bodyweight reps, or timed) | must | Test, Demonstration | W-03 | planned | |
| R-01.3 Archiving an exercise hides it from pickers but keeps it and its history; it can be restored; there is no delete | must | Test | W-03 | planned | |
| R-01.4 Two exercises cannot have the same name (ignoring case and surrounding spaces) | should | Test | W-03 | planned | |

## KF-02 Build reusable workout plans

*A plan is an ordered list of exercises with targets, reusable across splits.*

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-02.1 A plan is an ordered list of exercises, each with target sets and a rep range (a seconds range for timed exercises); you can add, remove and reorder them | must | Test, Demonstration | W-04 | planned | |
| R-02.2 On first launch the five plans from the brief exist with the brief's exercises, order and targets | must | Test | W-01 | planned | |
| R-02.3 Duplicating a plan makes an independent copy: editing the copy does not change the original | must | Test | W-04 | planned | |
| R-02.4 A plan entry can list alternate exercises (seeded for the brief's "A or B" entries) | should | Test | W-04 | planned | |

## KF-03 Build a split that repeats on a cycle and schedule it on my calendar

*Taylor's model: a split has a cycle of N days; a schedule puts a split on the calendar from a start date for a set length.*

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-03.1 A split has a cycle length (in days, entered as days or weeks) and one slot per day, each a plan or rest; several splits can exist | must | Test | W-05 | planned | |
| R-03.2 On first launch the default split exists: 7-day cycle, Push, Pull, Legs & Abs, Rest, Chest/Back/Arms, Shoulders & Legs, Rest | must | Test | W-01 | planned | |
| R-03.3 You can schedule a split from a start date for a length (days or weeks); every date in that range shows its planned workout or rest, and dates outside it show nothing | must | Test | W-05 | planned | |
| R-03.4 Today's planned workout follows the calendar: a missed day does not shift later days | must | Test | W-05 | planned | |
| R-03.5 Where two schedules overlap, the most recently created one decides the date | should | Test | W-05 | planned | |

## KF-04 Swap a plan or an exercise when I need to

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-04.1 You can override a single date with a different plan or rest without changing the split | must | Test | W-05 | planned | |
| R-04.2 You can permanently replace an exercise in a plan; the old exercise's past history is unchanged | must | Test | W-04 | planned | |
| R-04.3 During a session you can swap an exercise for that session only; its sets are logged against the substitute and the plan is unchanged | must | Test | W-06 | planned | |

## KF-05 Log every set quickly at the gym, pre-filled from last time

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-05.1 You can log each set's weight and reps (seconds for timed exercises; reps with optional added weight for bodyweight) | must | Test | W-06 | planned | |
| R-05.2 Each exercise's sets are pre-filled from the last session that exercise was done, whichever plan it was in | must | Test | W-06 | planned | |
| R-05.3 Tap targets on the logging screen are at least 44 × 44 points, and a pre-filled set is logged with one tap | must | Inspection, Demonstration | W-06 | planned | |
| R-05.4 Weights show in lb by default and in kg when set in Settings; switching units does not change stored values | must | Test | W-06 | planned | |
| R-05.5 Every logged set is saved the moment it is tapped, so closing the app mid-workout loses nothing | must | Test | W-06 | planned | |

## KF-06 See each exercise's whole history, PRs and progress

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-06.1 An exercise's history shows every set logged for it (date, weight, reps) from any plan or split, in one list | must | Test | W-08 | planned | |
| R-06.2 Personal records shown per exercise: heaviest weight, and best estimated 1-rep max | should | Test | W-08 | planned | |
| R-06.3 Estimated 1-rep max uses the Epley formula, only from sets of 1–12 reps | should | Test | W-08 | planned | |
| R-06.4 A chart shows weight and estimated 1-rep max over time | should | Demonstration | W-08 | planned | |

## KF-07 Keep a journal per workout and per day

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-07.1 Each workout session has a free-text note | should | Test | W-09 | planned | |
| R-07.2 Each day has a note with energy, sleep and soreness (1–5, optional) and free text | should | Test | W-09 | planned | |

## KF-08 Use it on my iPhone with bad gym wifi without losing my data

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-08.1 The app installs to the iPhone home screen and opens and works with no network after the first load | must | Demonstration | W-02 | planned | |
| R-08.2 Data is still there after closing the app, restarting the phone, and 8 days without opening it | must | Demonstration | W-02 | planned | |
| R-08.3 Export writes all data to a JSON file; importing that file into an empty app restores it exactly | must | Test | W-07 | planned | |
| R-08.4 Importing a damaged or wrong file is refused with a message, and existing data is left unchanged | must | Test | W-07 | planned | |

## KF-09 See the training tips

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-09.1 The four training tips from the brief are visible in the app | could | Demonstration | W-10 | planned | |

Totals: 23 must, 8 should, 1 could.

## Riskiest assumption

**An iPhone home-screen web app keeps its data indefinitely.** Safari can clear
website storage after 7 days without a visit; home-screen apps are said to be
exempt. If that is false on Taylor's phone, local-only storage is unsafe and the
plan needs a backup or sync design. Tested by W-02, right after the skeleton.

## Out of scope

- Accounts, sign-in, multiple users, cloud sync or cloud backup (JSON export is the backup)
- Nutrition or calorie tracking (the calorie tip is shown as text only)
- Warm-up set tracking, rest timer, supersets
- Android-specific testing (it should work, but only iPhone is checked)

## Assumptions to confirm

1. **Hosting:** GitHub Pages (Taylor has GitHub Pro, confirmed 2026-11-08). The
   site deploys from `main`, so the first iPhone test (W-02) needs a first
   release, which waits for Taylor's OK.
2. **Weights are stored in pounds** at full precision; kg is a display setting
   converted on screen.
3. **Timed exercises** (plank) log seconds; **walking lunges** log reps per leg.
4. **Plans can be deleted**; past sessions keep the plan's name. Exercises can
   only be archived.
5. **The default split's Day 1 is Push**; scheduling it from a Monday gives the
   brief's Mon–Sun layout.
6. **Release 1** (plan, schedule, log, export, install) comes before history,
   PRs and journal.
