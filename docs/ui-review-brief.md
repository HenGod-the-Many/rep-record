# UI review: brief

The job and the owner's answers. Status lives in [queue.md](queue.md) and the
[journal](journal.md), not here.

## Why

After release 3, Taylor (2026-11-24/25): the app works, but the UI is "bland and
clunky". Navigation in particular "doesn't feel as nice as I would like". The
goal is something "sleek and modern and intuitive to use".

## Agreed plan

1. **Audit, read-only (approved by Taylor 2026-11-25).** Screenshot every screen
   at iPhone size (390 × 844). Run the `design:design-critique` and
   `design:accessibility-review` skills against Apple's Human Interface
   Guidelines (iOS) and WCAG 2.1 AA. Count taps for common jobs (start a
   workout, log a set, add bodyweight, edit a plan, move a day). Deliver one
   page (an artifact) with screenshots, problems ranked by impact, "bland"
   (looks) kept apart from "clunky" (navigation and taps). No code changes.
2. **Direction.** Mock up 2–3 visual directions on one key screen; Taylor picks.
3. **Design system.** The chosen direction becomes written rules (colours,
   type scale, spacing, components) and a decision record.
4. **Build in slices** through a spec, screen by screen, with the usual review.

Steps 2–4 wait for Taylor after the audit.

## Taylor's answers so far

- No particular apps for inspiration. Wants sleek, modern, intuitive.
- **Home screen:** the stats, body metrics and the day's plan should all be on
  the home page when the app opens. From there: update metrics, or start the
  workout.
- **Calendar:** where the workout plans are seen over time.
- **Exercises, Plans and Splits** could be presented and navigated better; how
  is not decided yet. Taylor dislikes the word **"split"** and wants a better
  name for "a sequence of workouts repeated over a set period". The audit
  should propose names and a navigation structure (for example fewer tabs,
  with the library things grouped) as options, not decide them.
- **Appearance (2026-11-25):** "I'm good with light and dark mode." Support
  both, following the phone's light/dark setting. Every colour in the design
  system must pass WCAG AA contrast in both modes.
- Not answered yet: restyle only or also rework flows (the navigation answer
  suggests flows too).

## Limits

- The audit changes no code and opens no pull request for code.
- Don't copy any existing app's look.
- Keep within the project's rules (CLAUDE.md): history keys on exercise,
  exercises archived not deleted, weights stored in pounds.
