# Journal

Newest first.

## 2026-11-20: v0.2.0 and hotfix v0.2.1; specs for W-07, W-08, W-09

- Taylor started an unattended loop: keep developing and push completed
  releases. Released v0.2.0 (logging, build-a-workout-from-scratch, #12).
- Found on the live site: a new version downloaded but never took over; a
  reload kept the old one (the 2026-11-08 fix waited for a full close, which a
  home-screen app rarely gets). Hotfix v0.2.1 (#13): an "Update" bar applies a
  waiting version, and the app checks for updates whenever it returns to the
  screen. Checked with two local production builds; not yet on the iPhone.
- Preflight: no queue item is Ready, so nothing more can be built until Taylor
  approves a spec. Drafted specs W-07 (backup), W-08 (history, PRs, chart),
  W-09 (journal), each with questions for Taylor.
- Lesson: `git checkout -- <file>` to undo a test edit also threw away the
  uncommitted real change in that file. Test edits go in a copy, or commit first.
- Taylor said yes to Claude approving the release-2 specs. All seven were
  reviewed, fixed and marked Ready (#16), with default answers listed in each.
- Built, reviewed and released: W-07 backup (v0.3.0), W-08 history and W-09
  journal (v0.4.0), W-11 body metrics (v0.5.0, database version 4).
- Browser checks caught real bugs the tests missed: the photo picker was
  cleared before its files were read, and an image decode could hang.
- The first W-11 reviewer hung for an hour after starting `npm run check` in
  the background. Lesson: tell reviewers to run commands in the foreground.
- Paused at 81 % of the 5-hour usage window. Next: W-16 warm-ups, W-12 stats,
  W-15 activities (all Ready).

## 2026-11-19: W-06 logging built; v0.1.0 released

- Release v0.1.0 went live on GitHub Pages (Taylor said publish):
  https://hengod-the-many.github.io/rep-record/ . Deploys run on every push to main.
- Built W-06 on `feature/w06-logging`: database version 3 (set parts, difficulty,
  to failure, open/finished sessions), logging screen, Today buttons, lb/kg.
  Decision 0003 records the set shape.
- A test that sometimes failed found a real problem: two sets saved in the
  same millisecond could pre-fill from the wrong session. Pre-fill now picks the
  latest session by date and start time.
- /code-review: 10 findings, all fixed (pre-fill from a later session, quick
  ± taps lost, kg steps off the 2.5 grid, a kept date copy orphaning its
  logged workout, and smaller ones). Reviewer: accept after fixes; both fixed.
- Lesson: browser tests that set input values by script must also fire the
  blur event; and hot reload drops unsaved drafts, so reload for real first.
- Requirements: R-04.3 and R-05.1–R-05.10 verified except R-05.6 and R-05.7,
  which are built; their history part is W-08.

## 2026-11-18 (evening): W-05 and W-14 built

- Built splits, schedules, calendar, Today, rescheduling and Undo on
  `feature/w05-w14-schedules` ([rep-record#4](https://github.com/HenGod-the-Many/rep-record/pull/4)). 79 tests.
- Review round 1 caught decisions made without asking (deleting splits/plans,
  moving earlier, collisions) and a Move preview that could differ from the save.
  Taylor decided: delete a split with its dates after a warning (undoable); plan
  deletion as proposed; build moving earlier; confirm "update everywhere".
- Round 2 caught Undo silently discarding later split edits; Undo is now
  cancelled by any later change to schedules, dates or splits.
- /code-review fixed: overflow race on the Move screen, orphaned one-date plan
  copies (pruned at app start), Today going stale after midnight, rest alert
  counting unscheduled days, impossible dates accepted.
- Defaults chosen: new workouts start at Morning; days left behind by an
  "all future" move later become rest.
- Lesson: the PWA service worker keeps serving the old build after a rebuild;
  unregister it in the test browser before re-checking.
- Suggestion (not done): one shared name-cleaning helper for plans and splits.
- Handoff: Taylor asked for a link to try the app. There is none yet: no
  release tag, no GitHub Pages site and no deploy workflow exist. Publishing
  needs a deploy workflow, release v0.1.0 (dev to main, Taylor's OK) and Pages
  turned on; that is the first half of W-02.
- Requirements: 23 verified, 37 planned (none accepted yet).

## 2026-11-18 (later): rescheduling, multi-workout days, activities

- Taylor approved requirements revision 2, then added revision 3: several
  timed workouts per day; rescheduling (move within the week with rest days
  absorbing the push and an alert when rest days drop, overflow cut choices,
  move all future, quick day edits, edit one date then keep changes); 1–10
  difficulty and mid-set weight changes on every set; activities (KF-13) and
  warm-up routines (KF-14) in release 2.
- Rescheduling became its own item, W-14, sharing the W-05 spec. Activities and
  warm-ups are W-15 and W-16.
- Calories for activities: estimated from MET value, duration and bodyweight.
  Taylor mentioned height too; the MET method doesn't need it, so it is not
  used there.

## 2026-11-18: new repo, new name, body metrics added

- Taylor created `HenGod-the-Many/rep-record` and asked to move the project
  there; the app is now Rep Record (decision 0002). Old repo to be archived.
- Re-ran kickoff as a revision. Taylor confirmed KF-01 to KF-09 as they were.
- New: KF-10 body metrics (bodyweight and height by default; measurements,
  body fat %, photos and custom metrics optional; real entries plus a 7-day
  rolling average), KF-11 Stats overview with chosen cards, both release 2.
  KF-12 Apple Health is a later goal; a web app can't read Health directly, so
  W-13 is a spike first.
- Taylor widened Claude's permissions in user settings: shell commands and
  edits no longer prompt; force-push, repo delete and secret reads stay denied,
  and recursive deletes still ask.

## 2026-11-08: kickoff and first build

- Taylor handed over the brief and answered: iPhone; lb default with a kg
  setting; splits are a cycle of N days scheduled from a start date for a set
  length; GitHub Pro, so hosting is GitHub Pages.
- Installed the main/dev/feature git workflow (hook refusal on `dev` checked).
- Wrote requirements, verification plan, queue, specs for W-01 and W-03/W-04,
  and decision 0001. Requirements are still awaiting Taylor's approval.
- Taylor said "Yes, start" to building brief steps 1–2, so W-01, W-03 and W-04
  are being built on `feature/foundation` ahead of formal approval.
- Built W-01, W-03, W-04. `npm run check`: 26 tests pass. Proved checks can
  fail: a changed seed value and a half-broken reorder each failed their test.
- acceptance-reviewer: all 10 in-scope requirements met; asked for a stricter
  reorder test (old one passed 5 of 6 runs with a real bug) and screenshots of
  3 more screens. Both done.
- /code-review: 6 findings, all fixed. The important one: the offline worker
  was set to reload the page by itself when a new version deployed; now a new
  version waits until the app is fully closed.
- Lesson: when re-testing a built PWA in the browser, a hash-only URL change
  does not reload the page, so the old bundle kept running. Reload for real.
- Not pushed yet: waiting for Taylor's OK to push and open the pull request.
