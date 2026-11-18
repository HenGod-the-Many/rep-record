# Verification plan for Rep Record

How a function goes from a requirement to something Taylor can use, what proves
it works, and what happens when it does not. The requirements are in
[requirements.md](requirements.md).

## The working agreement

Proposed 2026-11-08; in force since Taylor approved the requirements on 2026-11-18:

- **Taylor** sets goals and priorities and gives the verdict on whether
  something works.
- **The builder decides** screen layout, wording, colours, code structure and
  test design, then shows it with screenshots and its reasoning.
- **The builder stops and asks** when a requirement looks wrong or unclear, a
  test looks wrong, a new runtime dependency beyond those in
  [decisions/0001-stack-and-storage.md](decisions/0001-stack-and-storage.md) or a
  secret is needed, or the same failure has happened twice.
- **Releasing:** the builder merges tested `feature/` and `fix/` work into `dev`
  after an independent review. Merging into `main` (a release, which also
  deploys the site) happens only when Taylor says so.
- **Boundaries:** work stays inside this repo folder. No accounts are created
  on Taylor's behalf.
- **Git:** branches and pull requests, per [git-workflow.md](git-workflow.md).

## What a release is

A set of requirements verified together that add up to something Taylor can do.

Before a release is called ready:

1. `npm run check` passes (type-check, unit tests, production build).
2. An independent reviewer has reported on every requirement in it, and each is
   `verified` in the trace.
3. The built app has been opened and used once at phone size, not only tested.
4. The journal, the queue and the trace are up to date.

Then Taylor runs the acceptance script. Only that makes it `accepted`.

## Releases

### Release 0.1: you can now open the app on your iPhone and see your exercises and plans

The skeleton plus the library and plan builder, deployed so the storage spike
(W-02) can run on the real phone.

- **Requirements:** R-01.1–R-01.4, R-02.1–R-02.4, R-04.2, and the start of R-08.1/R-08.2 (spike)
- **Acceptance script.**
  1. On the iPhone, open the site address in Safari. You should see the
     Exercises screen listing the seeded exercises.
  2. Share → Add to Home Screen, then open it from the home screen. It should
     open full-screen without Safari's address bar.
  3. Add an exercise "Test Curl" (Arms, Dumbbell). It should appear in the list.
  4. Open the Push plan. You should see Bench press 4 × 6–8 first and Rope tricep
     extensions 3 × 12–15 last.
  5. Duplicate Push, rename it "Push B", and replace Machine fly with Cable fly.
     Push should still show Machine fly.
  6. Turn on Airplane mode, close the app fully, reopen it. Everything above
     should still be there.
  7. Leave the app unopened for 8 days, then open it. "Test Curl" and "Push B"
     should still be there. (This is the spike; report the result either way.)
- **Evidence expected:** `npm run check` output, phone-size screenshots, reviewer verdict.
- **Way back:** none needed (first release).

### Release 1: you can now plan, schedule and log a real workout at the gym

- **Requirements:** all KF-03, KF-04, KF-05 and R-08.3–R-08.4 requirements
- **Acceptance script.**
  1. Schedule the default split from next Monday for 4 weeks. The calendar
     should show Push on Mondays and Rest on Thursdays for those 4 weeks, and
     nothing in week 5.
  2. Override one Wednesday to "Push B". Only that date should change.
  3. On a training day, start today's workout. Each exercise should show its
     sets pre-filled (empty the very first time).
  4. Log Bench press 3 sets with one tap each. Swap Machine fly for Cable fly
     for this session only and log a set. The Push plan should still list
     Machine fly.
  5. Close the app mid-workout and reopen. The logged sets should still be there.
  6. Next time you do Bench press, from any plan, its sets should pre-fill with
     the last weights and reps.
  7. In Settings switch to kg. Weights should show in kg; switch back and they
     should show the original lb values.
  8. Export, then import the file. Everything should be unchanged.
- **Evidence expected:** `npm run check` output, screenshots, reviewer verdict.
- **Way back:** previous tag (v0.1.0); data export before upgrading.

### Release 2: you can now see your progress, track your body and keep a journal

- **Requirements:** all KF-06, KF-07, KF-10 and KF-11 requirements
- **Acceptance script.**
  1. Open Bench press history after logging it from two different plans. One
     list should show both sessions' sets with dates.
  2. The PR panel should show your heaviest weight and best estimated 1-rep max.
  3. The chart should show one point per session.
  4. Add a note to today's workout and a day note with energy 4, sleep 3. Both
     should be there after reopening the app.
  5. Enter your height, then log bodyweight on 3 different days over a week,
     skipping some days. The chart should show the 3 real entries and a
     smoother 7-day average line, with no made-up points on skipped days.
  6. In Settings switch on Waist and Body fat %, and add a custom metric
     "Resting HR" in bpm. Log one value of each; each should appear with its
     own history. Switch Waist off: it disappears; switch it on again and the
     value is still there.
  7. Switch on progress photos, add one photo. It should show under today's
     date. Export: the file should include it (the file gets bigger).
  8. Open Stats. Hide the "Recent PRs" card and move "Bodyweight" to the top.
     Close and reopen the app: the layout should be as you left it.
  9. Switch to kg: bodyweight shows in kg and measurements in cm.
- **Evidence expected:** `npm run check` output, phone-size screenshots of the
  bodyweight chart, metrics settings and Stats screen, reviewer verdict.
- **Way back:** previous tag; export first.

### Spike W-13: can Apple Health data reach the app?

Not a release. The result decides whether KF-12 gets requirements. Test on
Taylor's iPhone: (a) an iOS Shortcut that reads the latest heart rate and steps
and opens the app with them; (b) importing the Health export file. Report what
worked, how many taps it took, and what it can't do.

### Release 3: you can now see the training tips, and the app is polished

- **Requirements:** R-09.1 plus any polish items Taylor adds.
- **Acceptance script.** 1. Find the tips. All four from the brief should be there.

## Defect log

| Id | Found | What broke | Real cause | Caught by | What stops it recurring |
|---|---|---|---|---|---|
