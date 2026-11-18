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
| 6 | W-06 | Logging screen: pre-fill, one-tap sets, difficulty 1–10 per set, mid-set weight changes, session-only swap, units setting | R-04.3, R-05.1–R-05.10 | [W-06](specs/W-06-logging.md) | W-14 | no | In progress | Started 2026-11-18. Spec approved by Taylor 2026-11-18 with changes (weight/rep change pick the set, Failed button) |
| 7 | W-07 | JSON export and import | R-08.3, R-08.4 | not yet | W-06 | no | Not ready | |
| 8 | W-08 | Exercise history, PRs, estimated 1RM, chart | R-06.1–R-06.4 | not yet | W-06 | no | Not ready | |
| 9 | W-09 | Journal: session notes and day notes | R-07.1, R-07.2 | not yet | W-06 | no | Not ready | |
| 10 | W-10 | Training tips and polish | R-09.1 | not yet | W-09 | no | Not ready | |
| 11 | W-11 | Body metrics: bodyweight + rolling average, height, optional measurements, body fat %, photos, custom metrics | R-10.1–R-10.7 | not yet | W-06 | no | Not ready | Added 2026-11-18 |
| 12 | W-12 | Stats overview with cards you choose | R-11.1, R-11.2 | not yet | W-08, W-11 | no | Not ready | Added 2026-11-18 |
| 13 | W-13 | Spike: get Apple Health data into the app (Shortcut or Health export) | KF-12 (risk) | not yet | W-02 | yes | Not ready | Later; result only Taylor can observe |
| 14 | W-15 | Activities: runs, rides, hikes, swims and custom; duration, distance, optional effort/HR/calories, estimated calories | R-13.1–R-13.5 | not yet | W-06, W-11 | no | Not ready | Added 2026-11-18; release 2 |
| 15 | W-16 | Warm-up routines attached to plans, checked off before a workout | R-14.1, R-14.2 | not yet | W-06 | no | Not ready | Added 2026-11-18; release 2 |

## Awaiting owner

Newest first.

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
