# Journal

Newest first.

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
