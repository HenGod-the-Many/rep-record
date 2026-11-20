# W-07: Export and import (backup)

Status: approved 2026-11-20 by Claude on Taylor's say-so (Taylor delegated release-2 spec approval); reviewed by acceptance-reviewer, fixes made. Taylor can overrule any answer under "Answers".
Cleared to run unattended: yes
Satisfies: R-08.3, R-08.4

## Goal

All of Taylor's data lives only on the phone. If Safari clears it, the phone
is lost, or an update goes wrong, a backup file is the only way back. So
saving a backup has to take a few taps from Settings, and restoring one has to
put back exactly what was there, or refuse and change nothing.

## Done when

- *Export (R-08.3).* Settings has **Back up data**. It makes one JSON file
  named `rep-record-backup-YYYY-MM-DD.json` holding every table in the
  database (exercises, plans, plan entries, splits, split days, schedules,
  date changes, sessions, sets, day notes, settings), plus the app name, the data version
  and the time of export. On iPhone it opens the share sheet, so the file can
  go to Files, iCloud Drive, AirDrop or mail. Where sharing a file isn't
  possible, it downloads instead. — test, demonstration
- *Every table, now and later.* Export reads the table list from the database
  itself, so tables added later (body metrics, photos, activities) are
  included without changing this code. A test fails if any table is missing
  from the file. Binary values (photos, from W-11) are written as base64 text
  with their type and read back byte for byte. — test
- *Round trip (R-08.3).* Export, wipe, import: every row in every table is
  equal to the original, field by field, including weights in pounds at full
  precision and finished/unfinished sessions. — test
- *Import replaces everything, after a warning.* Settings has **Restore from
  backup**. After picking a file it shows what's in it ("Backup from 20 Nov
  2026: 37 exercises, 12 workouts, 214 sets") and what will happen ("This
  replaces all data on this phone"). Restore needs a second tap to confirm.
  The replacement happens in one database transaction: either all of it or
  none. — test, demonstration
- *Damaged or wrong file is refused (R-08.4).* Not JSON, JSON from something
  else, a missing table, a row missing a required field, or a backup from a
  newer version of the app: refused with a plain message saying which, and
  the data on the phone is unchanged. A test checks each case and compares
  the database before and after. — test
- *Older backups still restore.* A backup made before a later item raised the
  data version (for example a v3 backup restored after W-11 adds tables) is
  brought up to the current shape with the same upgrade steps the app runs on
  itself, then restored. "Missing table" means missing for that backup's own
  version. — test
- *Last backup shown.* Settings shows "Last backup: 20 Nov 2026" (or "Never").
  Restoring keeps the phone's own last-backup date, not the older one from the
  file. Once at least one workout is logged, Today shows a one-line reminder
  linking to Settings when the last backup is more than 7 days old or never
  happened. — test
- Controls are at least 44 × 44 points; phone-size screenshots of Settings,
  the restore summary and a refusal message. — demonstration
- The project's check command passes: `npm run check`

## Out of scope

Automatic or scheduled backups, cloud sync, merging a backup into existing
data (restore always replaces), CSV export, exporting one plan to share with
someone else. Photos (W-11 adds them; this item only makes sure new tables are
included).

## Decisions already made

- Single user, no backend, data in IndexedDB via Dexie ([decision 0001](../decisions/0001-stack-and-storage.md)).
- Set shape with parts and difficulty ([decision 0003](../decisions/0003-set-shape-parts-and-difficulty.md)); the file stores rows exactly as the database holds them.
- To be recorded: decision 0004, the backup file format (top-level fields and
  version rule), because old backup files must keep restoring.

## Riskiest assumption

That a home-screen web app on iPhone can both hand a file to the share sheet
and pick a file back in. Safari has had gaps here for installed web apps.
Test it first with a throwaway button in the deployed app (share a small
file; pick it back with a file input), on Taylor's phone at the next release.
Until then, the unit tests and desktop browser cover the logic; if the share
sheet fails, fall back to a download link and say so in the PR.

## Slices

1. Format and decision 0004; export and import functions with tests (round
   trip, every table, each refusal, old versions, all-or-nothing).
2. Settings: Back up data, Restore from backup with summary and confirm, Last
   backup line.
3. Screenshots, `npm run check`, review, release so Taylor can try it on the
   phone.

## Stop and ask if

- Restoring an old-version backup can't reuse the app's own upgrade steps.
- A requirement looks wrong, or a test looks wrong.
- A new dependency or a secret is needed.
- The same failure happens twice.

## Acceptance script

Release 1 step 8 in [verification-plan.md](../verification-plan.md), in more detail, on the iPhone:

1. Settings → Back up data → save the file to Files.
2. Log one extra set. Settings → Restore from backup → pick the file. The
   summary shows the backup's date and counts; confirm.
3. The extra set is gone and everything else is as it was at backup time.
4. Try to restore a photo or any other non-backup file: it's refused with a
   message and nothing changes.

## Answers (decided 2026-11-20 under Taylor's delegation; Taylor can overrule)

1. Restore replaces everything on the phone; no merging.
2. Yes to a nudge: a one-line reminder on Today when the last backup is more
   than 7 days old (see "Last backup shown").
