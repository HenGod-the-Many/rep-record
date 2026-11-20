# 0005: Body metrics data shape

Date: 2026-11-20 · Item: W-11 · Status: decided (Claude, under Taylor's delegation for release 2)

## Context

Taylor wants bodyweight and height always, and other measurements, body fat,
photos and self-named metrics only when switched on. History, the Stats cards
(W-12), calorie estimates (W-15) and backups all read these values.

## Decision

- One generic `metrics` table (id, name, kind, unit, built in or not, always
  on, on/off, order) and one `metricEntries` table (metric, date, value), with
  an index on `[metricId+date]`. One entry per metric per date.
- Built-in metrics have fixed ids (`bodyweight`, `height`, `waist`, …) so the
  first-launch seed, the version-4 upgrade and a restored backup agree. They
  are added by both the seed and the upgrade.
- Kinds: `weight` stored in pounds, `length` in inches (both at full
  precision, shown as kg/cm when the unit setting is kg), `percent` and
  `custom` stored as typed, and `photos` (a switch only).
- Photos go in their own `photos` table as Blobs (shrunk to 1600 px on the
  long side, JPEG), and into backups as base64 (decision 0004).
- Database version 4.

## Rejected

- **A table per metric:** each new metric would need a database version and
  its own code in history, stats and backup.
- **Several entries per day:** Taylor's answer was one bodyweight per day; a
  second replaces the first after a confirm.
- **Photos as files outside the database:** a web app has no private file
  storage on iPhone that survives as reliably, and the backup would need a
  second file.

## Measured

A 3024 × 4032 photo (1.4 MB) is stored at 1200 × 1600, 439 KB, so about
585 KB in a backup file. Synthetic test photos came to about 220 KB each.
