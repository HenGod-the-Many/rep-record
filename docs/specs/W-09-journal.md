# W-09: Journal: workout notes and day notes

Status: draft 2026-11-20, awaiting Taylor's approval (questions at the end)
Cleared to run unattended: not yet
Satisfies: R-07.1, R-07.2

## Goal

Numbers don't explain a bad day. A note on the workout ("left shoulder tight")
and a quick daily check-in on energy, sleep and soreness let Taylor see later
why a session went the way it did.

## Done when

- *Workout note (R-07.1).* The logging screen has a "Note" box under the
  exercises. Text is saved as it is typed (no Save button) and is still
  there after closing the app. A finished workout shows its note on the day's
  card. The session's existing `journalNote` field is used; no new data shape. —
  test, demonstration
- *Day note (R-07.2).* Today and any date opened from the Calendar have a
  "Day note" section: energy, sleep and soreness, each 1 to 5 picked with one
  tap (tapping the chosen number again clears it), and a free-text box. All
  optional; saved as it's entered. The existing `dayNotes` table is used. —
  test, demonstration
- *Day notes without a workout.* A rest day can have a day note. — test
- *Seen later.* A date in the Calendar that has a day note or a workout note
  shows a small mark. — test, demonstration
- *In history.* The W-08 history list shows a workout's note under that
  session's sets, if W-08 is built first; otherwise this is added with W-08.
  — test
- Controls are at least 44 × 44 points; phone-size screenshots. —
  demonstration
- The project's check command passes: `npm run check`

## Out of scope

Searching notes, photos in notes, mood trends or charts of energy/sleep/
soreness (could become Stats cards in W-12), reminders to fill in the day
note.

## Decisions already made

- `Session.journalNote` and the `dayNotes` table (date, energy, sleep, soreness,
  note) already exist from W-01; no database version change.

## Riskiest assumption

That saving as you type is safe on iPhone: the keyboard closing, the app
going to the background, or a quick tab change must not lose the last words.
Test with a save on every change (debounced briefly) plus a save when the box
loses focus and when the page is hidden.

## Slices

1. Data functions with tests: save and read workout notes and day notes,
   clearing a rating, marks for the calendar.
2. Note box in the logging screen; note on the finished workout card.
3. Day note section on Today and day pages; calendar marks.
4. Screenshots, `npm run check`, review.

## Stop and ask if

- A requirement looks wrong, or a test looks wrong.
- The same failure happens twice.

## Acceptance script

Release 2 step 4 in [verification-plan.md](../verification-plan.md):

1. Add a note to today's workout and a day note with energy 4, sleep 3.
2. Close the app fully and reopen. Both are there.
3. Open a rest day in the Calendar and add a day note. The date gets a mark.

## Questions for Taylor

1. 1 to 5 for energy, sleep and soreness, as the requirements say (difficulty
   is 1 to 10). Keep 1 to 5?
2. Where should the day note sit on Today: above the workouts, or below them?
