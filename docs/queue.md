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
| 5 | W-05 | Splits with a cycle, schedules on a calendar, single-date overrides, Today | R-03.1, R-03.3–R-03.5, R-04.1 | not yet | W-04 | no | Not ready | |
| 6 | W-06 | Logging screen: pre-fill, one-tap sets, session-only swap, units setting | R-04.3, R-05.1–R-05.5 | not yet | W-05 | no | Not ready | |
| 7 | W-07 | JSON export and import | R-08.3, R-08.4 | not yet | W-06 | no | Not ready | |
| 8 | W-08 | Exercise history, PRs, estimated 1RM, chart | R-06.1–R-06.4 | not yet | W-06 | no | Not ready | |
| 9 | W-09 | Journal: session notes and day notes | R-07.1, R-07.2 | not yet | W-06 | no | Not ready | |
| 10 | W-10 | Training tips and polish | R-09.1 | not yet | W-09 | no | Not ready | |
| 11 | W-11 | Body metrics: bodyweight + rolling average, height, optional measurements, body fat %, photos, custom metrics | R-10.1–R-10.7 | not yet | W-06 | no | Not ready | Added 2026-11-18 |
| 12 | W-12 | Stats overview with cards you choose | R-11.1, R-11.2 | not yet | W-08, W-11 | no | Not ready | Added 2026-11-18 |
| 13 | W-13 | Spike: get Apple Health data into the app (Shortcut or Health export) | KF-12 (risk) | not yet | W-02 | yes | Not ready | Later; result only Taylor can observe |

## Awaiting owner

Newest first.

### W-01, W-03, W-04: skeleton, exercise library, plan builder

- Delivered in: branch `feature/foundation`, pull request to `dev` on `HenGod-the-Many/rep-record`
- Result: the app opens with the brief's 37 exercises, 5 plans and default split; exercises can be created, edited, archived and restored; plans can be built, reordered, duplicated, and have exercises replaced or given alternates.
- Evidence: `npm run check` passes (type-check, 26 tests, build); acceptance-reviewer verdict "accept after fixes", both fixes made (strict reorder test, missing screenshots); `/code-review` found 6 items, all fixed. Screenshots in `docs/evidence/foundation/`.
- Not verified: anything on a real iPhone or in Safari (that is W-02); offline loading was checked in desktop Chromium only.
- To accept, do this (needs release v0.1.0 so the site exists):
  1. Release 0.1 acceptance script steps 1–6 in `docs/verification-plan.md`.
