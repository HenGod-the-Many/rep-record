# Queue

The work, in order. A worker takes the first Ready item whose dependencies are
finished. Workers change only the Status column, the Notes of an item they
block, and the Awaiting owner list. Requirement status lives in
[requirements.md](requirements.md).

## Status words

| Status | Meaning | Who sets it |
|---|---|---|
| Not ready | No approved spec yet | Whoever adds the item |
| Ready | Spec approved and cleared to run | Owner |
| In progress | A worker has claimed it | Worker |
| Awaiting owner | Built, checked and reviewed; needs the acceptance script run | Worker |
| Accepted | The owner ran the acceptance script and it held | Owner |
| Blocked | Stopped; the reason is in Notes and the journal | Worker |

## Items

| Order | Id | Item | Satisfies | Spec | Depends on | Can run alongside | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | W-01 | Walking skeleton: app shell, data model, storage, seed data, `npm run check` | R-01.1, R-02.2, R-03.2 | [W-01](specs/W-01-skeleton.md) | none | no | Awaiting owner | Taylor said "Yes, start" for brief steps 1–2 on 2026-11-08 |
| 2 | W-02 | Spike: deploy to GitHub Pages, install on iPhone, check offline and 8-day persistence | R-08.1, R-08.2 (risk) | not yet | W-01; release v0.1.0 (Taylor's OK) | no | Not ready | Result only Taylor can observe |
| 3 | W-03 | Exercise library: list, search, create, edit, archive/restore | R-01.2, R-01.3, R-01.4 | [W-03/W-04](specs/W-03-W-04-library-and-plans.md) | W-01 | no | Awaiting owner | Brief step 2 |
| 4 | W-04 | Plan builder: create, reorder, targets, alternates, duplicate, permanent swap | R-02.1, R-02.3, R-02.4, R-04.2 | [W-03/W-04](specs/W-03-W-04-library-and-plans.md) | W-03 | no | Awaiting owner | Brief step 2 |
| 5 | W-05 | Splits with a cycle, several timed workouts per day, schedules, calendar, single-date overrides, Today | R-03.1, R-03.3–R-03.7, R-04.1 | [W-05/W-14](specs/W-05-splits-schedules-today.md) | W-04 | no | Awaiting owner | Spec approved by Taylor 2026-11-18; PR #4 merged to dev |
| 5b | W-14 | Rescheduling: move within the week, move all future, quick day edits, edit one date and keep changes | R-04.4–R-04.9 | [W-05/W-14](specs/W-05-splits-schedules-today.md) | W-05 | no | Awaiting owner | Spec approved by Taylor 2026-11-18; PR #4 merged to dev |
| 6 | W-06 | Logging screen: pre-fill, one-tap sets, difficulty 1–10 per set, mid-set weight changes, session-only swap, units setting | R-04.3, R-05.1–R-05.10 | [W-06](specs/W-06-logging.md) | W-14 | no | Awaiting owner | Spec approved by Taylor 2026-11-18 with changes; built 2026-11-19 |
| 7 | W-07 | JSON export and import | R-08.3, R-08.4 | [W-07](specs/W-07-export-import.md) | W-06 | no | Awaiting owner | Spec approved 2026-11-20 by Claude on Taylor's say-so; answers in the spec |
| 8 | W-08 | Exercise history, PRs, estimated 1RM, chart | R-06.1–R-06.4 | [W-08](specs/W-08-history-prs.md) | W-06 | no | Awaiting owner | Spec approved 2026-11-20 by Claude on Taylor's say-so; answers in the spec |
| 9 | W-09 | Journal: session notes and day notes | R-07.1, R-07.2 | [W-09](specs/W-09-journal.md) | W-06 | no | Awaiting owner | Spec approved 2026-11-20 by Claude on Taylor's say-so; answers in the spec |
| 10 | W-10 | Training tips and polish | R-09.1 | not yet | W-09 | no | Not ready | |
| 11 | W-11 | Body metrics: bodyweight + rolling average, height, optional measurements, body fat %, photos, custom metrics | R-10.1–R-10.7 | [W-11](specs/W-11-body-metrics.md) | W-06 | no | Awaiting owner | Added 2026-11-18. Spec approved 2026-11-20 by Claude on Taylor's say-so; answers in the spec |
| 12 | W-12 | Stats overview with cards you choose | R-11.1, R-11.2 | [W-12](specs/W-12-stats.md) | W-08, W-11 | no | Awaiting owner | Added 2026-11-18. Spec approved 2026-11-20 by Claude on Taylor's say-so; answers in the spec |
| 13 | W-13 | Spike: get Apple Health data into the app (Shortcut or Health export) | KF-12 (risk) | not yet | W-02 | yes | Not ready | Later; result only Taylor can observe |
| 14 | W-15 | Activities: runs, rides, hikes, swims and custom; duration, distance, optional effort/HR/calories, estimated calories | R-13.1–R-13.5 | [W-15](specs/W-15-activities.md) | W-06, W-11 | no | Ready | Added 2026-11-18; release 2. Spec approved 2026-11-20 by Claude on Taylor's say-so; answers in the spec |
| 15 | W-16 | Warm-up routines attached to plans, checked off before a workout | R-14.1, R-14.2 | [W-16](specs/W-16-warmups.md) | W-06 | no | Awaiting owner | Added 2026-11-18; release 2. Spec approved 2026-11-20 by Claude on Taylor's say-so; answers in the spec |

## Awaiting owner

Newest first.

### W-12: stats overview

- Delivered in: feature/w12-stats, pull request to `dev`
- Result: the Body tab is now **Stats**: overview cards on top (workouts this week and month, sets and volume this week, recent PRs, bodyweight with 7-day average, one per switched-on metric), chosen and ordered with Edit cards; the body metrics list below.
- Evidence: `npm run check` 201 tests (11 stats tests with known answers); screenshots in `docs/evidence/w12/` (cards, after edit and reload, Edit cards panel, empty states); acceptance-reviewer "accept after fixes" (added the Edit cards screenshot); `/code-review` 5 findings, all fixed.
- Not verified: on the iPhone.
- Calls made for you: a session that sets both a heaviest-weight and an estimated-max record shows as two PR rows.
- To accept: Release 2 step 8 in `docs/verification-plan.md`.

### W-16: warm-up routines

- Delivered in: feature/w16-warmups, pull request to `dev`
- Result: Plans → Warm-ups builds routines (moves with reps or a time); a plan's Warm-up choice attaches one; starting that workout shows the warm-up first, one tap per move, folding to "Warm-up done".
- Evidence: `npm run check` 190 tests (12 warm-up tests; deliberate breaks fail them); screenshots in `docs/evidence/w16/`; acceptance-reviewer "accept"; `/code-review` 5 findings, 4 fixed, 1 skipped (a speed-up not needed at this size).
- Not verified: on the iPhone.
- Calls made for you: workouts started before a warm-up was attached show no warm-up (moves are copied when a workout starts).
- To accept: Release 2 step 11 in `docs/verification-plan.md`.

### W-11: body metrics

- Delivered in: feature/w11-body-metrics, pull request to `dev`
- Result: a sixth **Body** tab with bodyweight (entries and a 7-day average line), height (feet and inches, or cm), and any measurements, body fat, progress photos or your own metrics switched on in Settings → Body metrics. One entry per day; a second asks before replacing. Photos stay on the phone, shrunk to 1600 px, and go into backups.
- Evidence: `npm run check` 178 tests (body tests fail when the window, the always-on rule or the seed is broken); screenshots in `docs/evidence/w11/`; acceptance-reviewer "accept after fixes" (the first review attempt hung and was restarted), fixed; `/code-review` 5 findings, all fixed.
- Measured: a 3024 × 4032 photo is stored at 1200 × 1600, 439 KB, about 585 KB in a backup.
- Not verified: adding photos from the iPhone camera and library; storage limits on the phone.
- Calls made for you: the average line joins entries up to 7 days apart and breaks after a longer gap.
- To accept: Release 2 steps 5 to 7 and 9 in `docs/verification-plan.md`.

### W-09: journal

- Delivered in: feature/w09-journal, pull request to `dev`
- Result: a Note box on every workout (saves as you type; shown on the finished workout's day card and in history); a Day note on Today and every date with energy, sleep and soreness 1–5 and text; days with a note get a small bar on the Calendar.
- Evidence: `npm run check` 162 tests (10 journal tests; deliberate breaks fail them); screenshots in `docs/evidence/w09/`; acceptance-reviewer "accept after fixes", fixed; `/code-review` 4 findings, all fixed.
- Not verified: saving when the iPhone app is swiped away straight after typing (spec's riskiest assumption).
- To accept: Release 2 step 4 in `docs/verification-plan.md`.

### W-08: exercise history, PRs, chart

- Delivered in: feature/w08-history, pull request to `dev`
- Result: each exercise has a History screen (from the exercise in Exercises, or the History button while logging): heaviest weight and best estimated 1-rep max with dates, a two-line chart (3 months or All), every set by workout with parts, difficulty and to-failure.
- Evidence: `npm run check` 152 tests (10 history tests; deliberate breaks fail them); screenshots in `docs/evidence/w08/`; acceptance-reviewer "accept after fixes", fixed; `/code-review` 5 findings, all fixed (typed numbers now survive a trip to History).
- Not verified: kg display on this screen (uses the tested unit formatting); speed on the phone.
- Calls made for you: parts are written "135 lb × 5 → 115 lb × 3" as on the logging screen.
- To accept: Release 2 steps 1 to 3 in `docs/verification-plan.md`.

### W-07: backup (export and restore)

- Delivered in: feature/w07-backup, pull request to `dev`; release v0.3.0
- Result: Settings → Backup: Back up data then Save backup file (iPhone share sheet; download where sharing isn't possible), Restore from backup with a summary and "Replace my data", Last backup date; a reminder on Today after 7 days without a backup.
- Evidence: `npm run check` 142 tests (20 backup tests; deliberate breaks fail them); screenshots in `docs/evidence/w07/`; acceptance-reviewer "accept after fixes", all 3 fixed; `/code-review` 6 findings, 5 fixed, 1 not needed.
- Not verified: the iPhone share sheet and file picker in the home-screen app (spec's riskiest assumption).
- Calls made for you: backing up is two taps because the share sheet only opens straight from a tap; a damaged row is judged by its key and searchable fields only (decision 0004).
- To accept: the acceptance script in `docs/specs/W-07-export-import.md` on the iPhone.

### Release 2 specs approved for you (2026-11-20)

- You said yes to Claude approving the release-2 specs so the loop can keep
  building. Each was checked by the acceptance-reviewer and fixed.
- Every open question took a default, listed under "Answers" at the end of each
  spec (W-07, W-08, W-09, W-11, W-12, W-15, W-16). Overrule any of them and the
  build follows your answer.
- Biggest calls: restore replaces all data; a backup reminder on Today after 7
  days; a sixth **Body** tab that becomes **Stats**; one bodyweight per day;
  one rep counts as its own 1-rep max.

### W-06: logging screen

- Delivered in: feature/w06-logging, pull request to `dev` (see the PR for the tap-count table)
- Result: Start/Resume/Done on Today; one card per exercise with pre-filled sets, one-tap logging, 1–10 difficulty, Weight change / Rep change / Failed, session-only swap, finish and reopen; lb/kg in Settings.
- Evidence: `npm run check` 117 tests; screenshots in `docs/evidence/w06/`; acceptance-reviewer "accept after fixes", both fixed (Clear button size, tap table in PR); `/code-review` 10 findings, all fixed.
- Not verified: on the iPhone (needs the next release).
- Your calls: (a) the first time you do an exercise, set 2 onward copies the set above instead of starting empty; (b) timed exercises have no change/Failed buttons; (c) a plan edited mid-workout: the screen follows the new plan and sets from removed slots show under "Also logged" (the spec said to ask; this was built instead, easy to change).
- To accept, after the next release: W-06 acceptance script in `docs/specs/W-06-logging.md` (Release 1 steps 3 to 7 and 14).

### W-05, W-14: splits, schedules, Today and rescheduling

- Delivered in: [rep-record#4](https://github.com/HenGod-the-Many/rep-record/pull/4), squash-merged to `dev`
- Result: splits with timed multi-workout days go on the calendar; Today shows the day's workouts; a day can be moved later or earlier within the week (with rest-day warning and cut choice) or for all future; single dates can be cleared, replaced, edited and kept as a new plan; Undo after each change.
- Evidence: `npm run check` 79/79 tests; phone-size screenshots in `docs/evidence/w05-w14/`; acceptance-reviewer accept after fixes (2 rounds, all must-fix items fixed); `/code-review` 7 findings, 6 fixed.
- Not verified: on the iPhone (needs release v0.1.0 and W-02); the round-2 Undo fix was checked by tests only.
- To accept, do this after the next release: Release 1 acceptance steps 1, 2, 9 to 13 in `docs/verification-plan.md` (steps 3 to 8 and 14 need logging, W-06).

### W-01, W-03, W-04: skeleton, exercise library, plan builder

- Delivered in: [rep-record#1](https://github.com/HenGod-the-Many/rep-record/pull/1), squash-merged to `dev`
- Result: the app opens with the brief's 37 exercises, 5 plans and default split; exercises can be created, edited, archived and restored; plans can be built, reordered, duplicated, and have exercises replaced or given alternates.
- Evidence: `npm run check` passes (type-check, 26 tests, build); acceptance-reviewer verdict "accept after fixes", both fixes made (strict reorder test, missing screenshots); `/code-review` found 6 items, all fixed. Screenshots in `docs/evidence/foundation/`.
- Not verified: anything on a real iPhone or in Safari (that is W-02); offline loading was checked in desktop Chromium only.
- To accept, do this (needs release v0.1.0 so the site exists):
  1. Release 0.1 acceptance script steps 1–6 in `docs/verification-plan.md`.
