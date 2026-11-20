# What Rep Record has to do, and what proves it does

Status: approved, revision 3. Written 2026-11-08 from Taylor's brief ("Workout
Planner, Journal & Log: Project Brief") and Taylor's answers in the first Claude
Code session. Revised 2026-11-18: the app is now Rep Record, and Taylor
confirmed KF-01 to KF-09 and added body metrics (KF-10), a stats overview
(KF-11) and an Apple Health goal (KF-12). Approved by Taylor 2026-11-18 ("Yes I approve").
Revision 3, same day, from Taylor's own additions: several workouts per day
with times, rescheduling (R-04.4 to R-04.9), a difficulty rating and mid-set
weight changes on every set, activities (KF-13) and warm-up routines (KF-14).
Revision 3 is approved together with the W-05/W-14 spec.
R-05.9 and R-05.10 added 2026-11-18 from Taylor's feedback on the W-06 spec
(change buttons that pick the set, and a "Failed" mark), approved with it.

Four levels, each traceable to the next:

```
Key function (KF-nn)    what the user needs to do, in the owner's words
  Requirement (R-nn.n)  something checkable that would satisfy it
    Item                the work, from the queue (docs/queue.md)
      Evidence          tests, screenshots and merged pull requests
```

**Priority:** must, should, could or later. Must means the project is pointless
without it.

Evidence screenshots are numbered files in `docs/evidence/foundation/`.

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
| KF-10 | Track my bodyweight, height and whichever other body metrics I choose | should | 2 | planned |
| KF-11 | See an overview of my body, gym and workout stats, with the cards I pick | should | 2 | planned |
| KF-12 | Pull heart rate and other health data from Apple Health | later | — | planned |
| KF-13 | Plan and log runs, rides, hikes, swims and any other activity | should | 2 | planned |
| KF-14 | Build warm-up routines and use them before a workout | should | 2 | planned |

---

## KF-01 Keep a library of my exercises

*Every exercise is a permanent "brick" that history hangs off.*

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-01.1 On first launch the library holds every exercise named in the brief's five plans, once each; "A or B" entries become two separate exercises | must | Test | W-01 | verified | seed.test.ts "library holds every exercise…"; reviewer: met |
| R-01.2 You can create and edit an exercise's name, muscle group, equipment and kind (weight × reps, bodyweight reps, or timed) | must | Test, Demonstration | W-03 | verified | exercises.test.ts create/edit; evidence 2, 8; reviewer: met |
| R-01.3 Archiving an exercise hides it from pickers but keeps it and its history; it can be restored; there is no delete | must | Test | W-03 | verified | exercises.test.ts archiving; evidence 9, 10; reviewer: met |
| R-01.4 Two exercises cannot have the same name (ignoring case and surrounding spaces) | should | Test | W-03 | verified | exercises.test.ts unique names; evidence 2; reviewer: met |

## KF-02 Build reusable workout plans

*A plan is an ordered list of exercises with targets, reusable across splits.*

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-02.1 A plan is an ordered list of exercises, each with target sets and a rep range (a seconds range for timed exercises); you can add, remove and reorder them | must | Test, Demonstration | W-04 | verified | plans.test.ts plan builder (strict reorder); evidence 3, 6; reviewer: met |
| R-02.2 On first launch the five plans from the brief exist with the brief's exercises, order and targets | must | Test | W-01 | verified | seed.test.ts "five plans match the brief"; reviewer: met |
| R-02.3 Duplicating a plan makes an independent copy: editing the copy does not change the original | must | Test | W-04 | verified | plans.test.ts duplicating; reviewer: met |
| R-02.4 A plan entry can list alternate exercises (seeded for the brief's "A or B" entries) | should | Test | W-04 | verified | plans.test.ts alternates; evidence 6; reviewer: met |

## KF-03 Build a split that repeats on a cycle and schedule it on my calendar

*Taylor's model: a split has a cycle of N days; a schedule puts a split on the calendar from a start date for a set length.*

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-03.1 A split has a cycle length (in days, entered as days or weeks) and one slot per day, each a plan or rest; several splits can exist | must | Test | W-05 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |
| R-03.2 On first launch the default split exists: 7-day cycle, Push, Pull, Legs & Abs, Rest, Chest/Back/Arms, Shoulders & Legs, Rest | must | Test | W-01 | verified | seed.test.ts default split; reviewer: met |
| R-03.3 You can schedule a split from a start date for a length (days or weeks); every date in that range shows its planned workout or rest, and dates outside it show nothing | must | Test | W-05 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |
| R-03.4 Today's planned workout follows the calendar: a missed day does not shift later days | must | Test | W-05 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |
| R-03.5 Where two schedules overlap, the most recently created one decides the date | should | Test | W-05 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |
| R-03.6 A date can hold more than one workout (e.g. a bike ride in the morning and lifting in the evening), in a split day, an override or a rescheduled day; each has a time: morning, noon, evening or night by default, or a custom clock time | must | Test | W-05 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |
| R-03.7 The week runs Monday to Sunday by default; Settings can change the first day of the week | should | Test | W-05 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |

## KF-04 Swap a plan or an exercise when I need to

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-04.1 You can override a single date with a different plan or rest without changing the split | must | Test | W-05 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |
| R-04.2 You can permanently replace an exercise in a plan; the old exercise's past history is unchanged | must | Test | W-04 | verified | plans.test.ts permanent swap; evidence 5; reviewer: met |
| R-04.3 During a session you can swap an exercise for that session only; its sets are logged against the substitute and the plan is unchanged | must | Test | W-06 | verified | logging.test.ts swap tests; browser: Machine fly → Cable fly, plan unchanged; reviewer: met |
| R-04.4 *Move within the week:* moving a planned day to a later or earlier date in the same week puts it there; the other planned days from the earlier of the two dates on keep their order and move later only as far as needed, so rest days (and the day left empty) absorb the shift; nothing moves past the last day of the week (moving earlier added by Taylor, 2026-11-18) | must | Test | W-14 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |
| R-04.5 After a move within the week, if the number of rest days between the new date and the end of the week has gone down, the app says so before you confirm | must | Test | W-14 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |
| R-04.6 If the shifted workouts don't fit before the week ends, you choose: drop the trailing workouts, or pick which workouts to drop | must | Test | W-14 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |
| R-04.7 *Move all future:* shifting a schedule by N days (later or earlier) from a date moves every later planned day by N days, keeping the order and the rest days; the schedule's end moves by N days too; moving later leaves the skipped days as rest, moving earlier replaces what was planned on the days it now covers; days before both dates are unchanged | must | Test | W-14 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |
| R-04.8 You can quickly clear a planned day (make it rest), replace its workout with another plan, or add a second workout to it, for that date only | must | Test | W-14 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |
| R-04.9 Editing the workout on one date (add, remove or change exercises or targets) changes that date only; a button on that edited workout then lets you either update the plan everywhere or save it as a new plan for future splits | should | Test | W-14 | verified | PR #4; reviewer: met (schedule/reschedule tests, evidence w05-w14) |

## KF-05 Log every set quickly at the gym, pre-filled from last time

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-05.1 You can log each set's weight and reps (seconds for timed exercises; reps with optional added weight for bodyweight) | must | Test | W-06 | verified | logging.test.ts "three kinds"; reviewer: met |
| R-05.2 Each exercise's sets are pre-filled from the last session that exercise was done, whichever plan it was in | must | Test | W-06 | verified | logging.test.ts pre-fill tests; evidence w06/02; reviewer: met |
| R-05.3 Tap targets on the logging screen are at least 44 × 44 points, and a pre-filled set is logged with one tap | must | Inspection, Demonstration | W-06 | verified | browser size script: no control under 44×44 (incl. Clear, evidence w06/05); 1 tap per pre-filled set; reviewer: met after fix |
| R-05.4 Weights show in lb by default and in kg when set in Settings; switching units does not change stored values | must | Test | W-06 | verified | units.test.ts; browser: 135 lb ↔ 61.23 kg; reviewer: met |
| R-05.5 Every logged set is saved the moment it is tapped, so closing the app mid-workout loses nothing | must | Test | W-06 | verified | logSet writes at once; evidence w06/01 after reload; reviewer: met |
| R-05.6 Every set can carry a difficulty rating from 1 to 10, entered with one tap; it is shown next to that set in history and in the next session's pre-fill, because it is the main sign of being ready to go up in weight | must | Test, Demonstration | W-06 | built | logging stored and shown in pre-fill (evidence w06/02; reviewer: met); shown in history by W-08 (screenshot w08/01; reviewer: met) |
| R-05.7 Within one set you can record a weight change partway through (e.g. 5 reps at 135 lb then 3 at 115 lb) in a few taps; history and PRs count each part at its own weight | should | Test | W-06 | built | parts stored, 135→115 at rep 6 tested (reviewer: met); W-08 shows each part and counts each part at its own weight (test fails if later parts are ignored; reviewer: met after test fix) |
| R-05.8 Logging a set, its difficulty and a weight change each takes no more than a few seconds, so it fits in a rest period | must | Demonstration | W-06 | verified | tap counts 1/1/3/3/4 counted in the browser; reviewer: met |
| R-05.9 Weight changes and rep changes are recorded with their own buttons, separate from adjusting a set's planned weight and reps; you pick which set changed (and for weight, at which rep), and every other set keeps its listed weight and reps | should | Test, Demonstration | W-06 | verified | logging.test.ts "only the chosen set changes"; evidence w06/04; reviewer: met |
| R-05.10 A set can be marked as taken to failure, with the number of reps reached (e.g. aimed for 10, failed after 8); the mark shows on the set and in the next session's pre-fill | should | Test | W-06 | verified | logging.test.ts "failed"; evidence w06/01, 02; reviewer: met |

## KF-06 See each exercise's whole history, PRs and progress

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-06.1 An exercise's history shows every set logged for it (date, weight, reps) from any plan or split, in one list | must | Test | W-08 | verified | history.test.ts (any plan, swap, scratch workout, archived); evidence w08/01 |
| R-06.2 Personal records shown per exercise: heaviest weight, and best estimated 1-rep max | should | Test | W-08 | verified | records tests incl. parts at own weight |
| R-06.3 Estimated 1-rep max uses the Epley formula, only from sets of 1–12 reps | should | Test | W-08 | verified | Epley test 225×5=262.5, 13 reps excluded |
| R-06.4 A chart shows weight and estimated 1-rep max over time | should | Demonstration | W-08 | verified | chart points test; screenshot w08/01 |

## KF-07 Keep a journal per workout and per day

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-07.1 Each workout session has a free-text note | should | Test | W-09 | built | journal.test.ts; saved after typing then tapping Back at once (browser); evidence w09/03 |
| R-07.2 Each day has a note with energy, sleep and soreness (1–5, optional) and free text | should | Test | W-09 | built | journal.test.ts (1–5, clear, empty removed, rest day); evidence w09/01, w09/02 |

## KF-08 Use it on my iPhone with bad gym wifi without losing my data

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-08.1 The app installs to the iPhone home screen and opens and works with no network after the first load | must | Demonstration | W-02 | planned | |
| R-08.2 Data is still there after closing the app, restarting the phone, and 8 days without opening it | must | Demonstration | W-02 | planned | |
| R-08.3 Export writes all data to a JSON file; importing that file into an empty app restores it exactly | must | Test | W-07 | verified | round-trip test in src/db/backup.test.ts; browser check docs/evidence/w07/; reviewer: met |
| R-08.4 Importing a damaged or wrong file is refused with a message, and existing data is left unchanged | must | Test | W-07 | verified | 9 refusal tests and an all-or-nothing test compare all data before and after; reviewer: met after test fix |

## KF-09 See the training tips

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-09.1 The four training tips from the brief are visible in the app | could | Demonstration | W-10 | planned | |

## KF-10 Track my bodyweight, height and whichever other body metrics I choose

*Taylor, 2026-11-18: bodyweight and height are the defaults; every other metric
is optional and the user chooses what to see. Entries come as often as the user
makes them; show the real data and a rolling average.*

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-10.1 You can log bodyweight with a date (several days, any gaps); entries can be edited and deleted | should | Test | W-11 | planned | |
| R-10.2 You can record height; it is kept as the current value and used wherever height is needed | should | Test | W-11 | planned | |
| R-10.3 A bodyweight chart shows every real entry and a 7-day rolling average, where the average for a date uses only entries from that date and the 6 days before it; a gap in entries leaves a gap, not an invented value | should | Test, Demonstration | W-11 | planned | |
| R-10.4 In Settings you can switch on optional metrics: body measurements (waist, chest, hips, upper arm, thigh, neck, calf), body fat %, progress photos, and custom metrics you name with a unit; switched-off metrics are hidden but their data is kept | should | Test | W-11 | planned | |
| R-10.5 Each switched-on numeric metric can be logged by date and shows its own history and chart | should | Test | W-11 | planned | |
| R-10.6 Progress photos are taken or picked on the phone, stored only on the phone, shown by date, and included in the export | could | Test, Demonstration | W-11 | planned | |
| R-10.7 Bodyweight and measurements store in pounds and inches and display in kg and cm when the unit setting is metric | should | Test | W-11 | planned | |

## KF-11 See an overview of my body, gym and workout stats, with the cards I pick

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-11.1 A Stats screen shows cards; available cards include current bodyweight and its 7-day average, workouts this week and this month, total sets and volume this week, recent PRs, and the latest value of each switched-on metric | should | Test, Demonstration | W-12 | planned | |
| R-11.2 You can choose which cards appear and their order; the choice is kept | should | Test | W-12 | planned | |

## KF-12 Pull heart rate and other health data from Apple Health

*A goal for later. A web app cannot read Apple Health directly. The candidate
routes are an iOS Shortcut that reads Health data and hands it to the app, or
importing the file Health exports. W-13 is a spike to find out which works on
Taylor's phone before any requirement is written.*

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-12.1 To be written after the W-13 spike | later | — | W-13 | planned | |

## KF-13 Plan and log runs, rides, hikes, swims and any other activity

*Taylor, 2026-11-18: the app is not only for lifting. Type and duration at the
least; distance by default; calories estimated; other details optional.*

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-13.1 Activities are a kind of exercise: run, walk, bike, hike, swim, row and elliptical are built in, and you can add your own | should | Test | W-15 | planned | |
| R-13.2 An activity is logged with duration and distance (miles or km by the unit setting); distance can be left out for activities without one | should | Test | W-15 | planned | |
| R-13.3 Optional fields per activity: effort 1–10, average heart rate, and calories typed in by hand | should | Test | W-15 | planned | |
| R-13.4 If calories are not typed in, the app estimates them from the activity's standard MET value, the duration and your latest bodyweight, and labels the number as an estimate | should | Test | W-15 | planned | |
| R-13.5 Activities can go in plans and splits like lifting exercises, so a day can hold "Bike ride 45 min" | should | Test | W-15 | planned | |

## KF-14 Build warm-up routines and use them before a workout

| Requirement | Priority | Method | Item | Status | Evidence |
|---|---|---|---|---|---|
| R-14.1 You can build named warm-up routines: an ordered list of moves, each with reps or a time | should | Test | W-16 | planned | |
| R-14.2 A plan can have a warm-up routine attached; starting that workout shows the warm-up first, and each move is checked off with one tap | should | Test, Demonstration | W-16 | planned | |

Totals: 31 must, 28 should, 2 could, 1 later.

## Riskiest assumption

**An iPhone home-screen web app keeps its data indefinitely.** Safari can clear
website storage after 7 days without a visit; home-screen apps are said to be
exempt. If that is false on Taylor's phone, local-only storage is unsafe and the
plan needs a backup or sync design. Tested by W-02, right after the skeleton.

## Out of scope

- Accounts, sign-in, multiple users, cloud sync or cloud backup (JSON export is the backup)
- Reading Apple Health directly, until the W-13 spike shows a way (KF-12)
- Nutrition or calorie tracking (the calorie tip is shown as text only)
- Rest timer, supersets (warm-up routines moved into scope as KF-14 on 2026-11-18)
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
7. **Body metrics and the stats overview ship in release 2**, with history and
   journal (Taylor, 2026-11-18).
8. **Measurement list:** waist, chest, hips, upper arm, thigh, neck, calf. Others
   can be added as custom metrics.
9. **Progress photos** make the export file much larger; the size per photo is
   measured when W-11 is built.
