# Journal

Newest first.

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
