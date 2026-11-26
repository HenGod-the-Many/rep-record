# Journal

Newest first.

## 2026-11-25 (evening): hotfix v0.8.1, UI answers, step 2 directions

- **Hotfix v0.8.1 released** (#37 into main, tag v0.8.1, #41 main → dev). Bug
  from Taylor's workout: after a weight change, the reps after the drop could
  not be edited (120 × 6 → 100 × 1 instead of → 100 × 5). Each weight in a
  weight-changed set now has its own weight and reps steppers. Two new tests
  (failed before, pass after); `npm run check` 259 pass; checked in the app at
  phone size; deploy succeeded and the live bundle contains the new text.
  Not tried on the iPhone. Own bug caught before merge: "Back to one weight"
  briefly kept the second weight; fixed and re-checked.
- Lesson: the audit session shared this folder, so switching branches here
  would have moved its work. The hotfix moved to its own worktree
  (../rr-hotfix, now removed).
- **Taylor's UI answers** (brief): option A, "Program" for split, "Workout"
  for plan, restyle and rework flows, home in three groups, both proposed
  metrics (weekly volume, plan adherence). Future features W-21 to W-24
  pocketed in the queue (#40).
- **Step 2 started:** three visual directions for the home screen, each in
  light and dark, on a design canvas:
  [Rep Record home screen: three visual directions](https://claude.ai/artifact/Mg4JmpVt4THJMbJqAE5RKw)
  (private to Taylor). Source kept in docs/design/home-directions/. Sample
  numbers. Colours chosen to pass 4.5 : 1 in both modes (worked by hand, not
  measured on the rendered page). Waiting for Taylor to pick one.

## 2026-11-25: UI audit (step 1 of the UI review)

- Read-only audit of dev (6793e5f) at 390 × 844, published as an artifact:
  [Rep Record UI audit](https://claude.ai/artifact/2PvXoTtXL2MpDM7hiS1tM3)
  (private to Taylor). No app code changed. Seeded data through the app's own
  functions in the dev server's browser storage only.
- Finding: logging is fast (1 tap a set, +1 to rate); navigation is the
  problem. Six text-only tabs, half for setup; no home screen; bodyweight is 4
  taps, changing a plan's reps 6 taps plus a scroll, backup 2 taps, a scroll
  and the share sheet. The look is one grey card style (cards 1.13 : 1 against
  the page, edges 1.4–1.6 : 1).
- Measured: text contrast passes (16.3 : 1 body, 7.4 : 1 grey); every button
  is at least 44 × 44 pt. Fails: placeholders 3.06–3.55 : 1 (the set inputs'
  target text among them), other-month calendar days 3.46 : 1, field and card
  edges below 3 : 1, current tab not announced to VoiceOver, no focus ring on
  buttons, no Dynamic Type, dark only.
- Offered Taylor three navigation options (A four tabs with a Library, B three
  tabs and a Start button, C five tabs), a home-screen wireframe, and names
  for "split" (Program, Rotation, Cycle, Routine, Block). Decisions are
  Taylor's; steps 2–4 wait for them.
- Lesson: the artifact tool only attaches files from folders the session may
  read, not the scratchpad; the shared notes folder worked.
- Same evening: release 3 was released as v0.8.0 (#36 dev → main, tag
  v0.8.0), so the "not released" line in the handoff entry below is out of
  date. Taylor answered the appearance question: light and dark, following
  the phone (recorded in the UI brief). The app has no light theme yet, so
  the audit measured dark only; the design system must pass in both.

## 2026-11-25: release 3 built; UI review next (handoff)

- Release 3 is on dev, not released: W-17 (#32), W-18 (#33), W-19 (#34),
  all Awaiting owner. `npm run check`: 257 tests pass. Latest tag is still
  v0.7.0, so the live site doesn't have release 3 yet.
- Taylor wants to try release 3 on the phone; that needs release v0.8.0
  (dev to main), which waits for Taylor's OK. Asked twice, not answered yet.
- Taylor finds the UI bland and clunky, especially navigation. Agreed a
  four-step plan; step 1 (read-only audit) approved. Brief and Taylor's
  answers (home screen with stats, metrics and the day's plan; rename
  "split") in [ui-review-brief.md](ui-review-brief.md).
- Context was ~420k tokens; Taylor asked for this handoff.

## 2026-11-24: release 3 specs approved; W-17 built

- Taylor's first real workout went well. Requests became three specs (W-17
  logging as-run, W-18 plan folders, W-19 supersets and circuits); Taylor
  approved them with every default answer (#31).
- W-17 built: as-run order (`Session.slotOrder`, no database version bump as
  it isn't indexed), folding, Rep change removed. Reviewer round 1 "accept
  after fixes": folding waited for a rating. Fixed by folding also when a set
  is logged in another exercise; folding at the instant the last set is logged
  would hide the one-tap rating (R-05.6), recorded as "As built" in the spec
  for Taylor to overrule. Re-check: accept.
- Lesson: `git checkout -- <file>` to undo a deliberate test break also threw
  away uncommitted work in that file (restored from a copy). Commit before
  breaking things on purpose, then undo with `git restore`.
- Reviewer note left alone: deleting a set in the next exercise can reopen
  the folded card above (harmless).
- W-18 built: `folders` table (database version 7), Folder choice on a plan,
  duplicate folder, Warm-ups row on Plans. Reviewer: accept, no must-fix.
  Code-review's 3 small findings were fixed after the review (tests added).
- W-19 built: groups on plan entries (decision 0007, no database change),
  round-by-round group card, plan editor, warm-up rounds. The riskiest
  assumption was tested first: a 3-exercise round fits at 390 x 844 after
  merging each exercise's name into its set line; only the latest rating
  picker stays open so the next set stays in view. Bug found in the browser
  and fixed: a tapped rating chip in a group didn't open. Reviewer: accept,
  noting "Next round" sat below the fold; moved next to the round title.
  Code-review's 5 findings fixed after the review.
- Lesson: long heredocs in Bash broke again (quote parsing); scripts written
  to the scratchpad with the Write tool worked every time.

## 2026-11-22: release 2 finished (W-12, W-15) and released as v0.7.0

- Taylor: "Finish release 2 and push it."
- W-12 stats: fixed the 5 code-review findings, reviewed (accept after fixes:
  added the Edit cards screenshot), merged (#27).
- The reviewer hang is understood well enough to avoid: reviewers given an
  exact list of allowed commands (`npm run check` once with a timeout,
  `npx vitest run <file>`, never in the background, no dev server) finished
  in about a minute, twice. Both earlier hangs were open-ended runs.
- W-15 activities built in a separate git worktree (`.worktrees/w15`) while
  W-12 was in review, then rebased onto dev. Reviewed (accept), 5 code-review
  findings and 2 reviewer notes fixed, merged (#28). Database version 6.
- Lesson: the browser check found the activity steppers squeezed to 40 px
  next to the ✓ button; tests can't see that. Keep measuring control sizes.
- Release 2 is complete: W-07, W-08, W-09, W-11, W-12, W-15, W-16 are all
  Awaiting owner. Left in the queue: W-02 and W-13 (spikes only Taylor can
  run on the phone) and W-10 (release 3, training tips).

## 2026-11-20 (morning): v0.6.0 warm-ups; W-12 built, stopped at review

- Released v0.6.0 (W-16 warm-up routines, database version 5).
- W-12 stats is built on `feature/w12-stats` (pushed, not merged): 201 tests
  pass, browser-checked at phone size, `/code-review` gave 5 small findings
  (not yet fixed: week doesn't roll over at midnight while open; e1RM PRs show
  2 decimals; week range read per card; sets/volume repeat queries; metric
  page loading header says "Body").
- **Stopped: the acceptance-reviewer hung a second time** (same failure twice).
  - What was tried: W-11's first reviewer hung ~1 h after saying it started
    `npm run check` in the background; it was stopped and a retry told to run
    everything in the foreground, which worked (as did W-16's reviewer). W-12's
    reviewer, with the same foreground instruction, wrote a 125-byte draft
    stub at 06:25 and then nothing for 38 minutes; a status message got no
    reply; it was stopped at 07:02.
  - What seems to decide it: both hangs stall right after the first draft
    save, before any verdict, which points at one long-running command the
    reviewer waits on (a background `npm run check`, or a test runner left in
    watch mode such as a bare `npx vitest` instead of `npx vitest run`).
    Untested.
  - Next session: give the reviewer the exact commands to use
    (`npm run check` with a timeout, `npx vitest run <file>`) and forbid
    `run_in_background`; then finish W-12 (review, the 5 fixes, merge,
    release) and build W-15 activities, the last release-2 item.

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
