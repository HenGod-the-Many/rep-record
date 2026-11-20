# 0004: Backup file format

Date: 2026-11-20 · Item: W-07 · Status: decided (Claude, under Taylor's delegation for release 2)

## Context

The backup file is the only way back if the phone loses its data. Files made
today must still restore after later items add tables and raise the database
version (W-11 body metrics and photos, W-15 activities, W-16 warm-ups).

## Decision

- One JSON file: `{ app: "rep-record", dataVersion, exportedAt, tables }`.
  `tables` maps each table name to its rows exactly as the database holds them
  (weights in pounds at full precision).
- Export reads the table list from the database, so new tables are included
  without code changes.
- Binary values (photos) are written as `{ "__repRecordBlob": base64, "type" }`
  and turned back into the same bytes on restore.
- Version rule: a file from a newer app is refused. A file from an older
  version is loaded into a temporary database of its own version and opened
  with the app's full schema, so the app's own upgrade steps bring it up to
  date (`WorkoutDB(name, upTo)` declares only versions up to `upTo`).
- Checks before anything changes: readable JSON, the app name, a version,
  every table of that version present, every row carrying its key (and, for a
  current-version file, every indexed field).
- Restore replaces all data in one transaction. The phone keeps its own
  last-backup date.

## Rejected

- **Merging a backup into existing data:** needs rules for conflicting edits
  and duplicate names; restore-to-replace is exact and enough for a
  single-user backup.
- **Converting old files with separate code:** two copies of each upgrade
  would drift apart; reusing the app's upgrade steps keeps one.
- **A zip with photos as separate files:** needs a new dependency; base64 in
  JSON is about a third larger but keeps one plain file.
