# W-11: Body metrics

Status: draft 2026-11-20, awaiting Taylor's approval (questions at the end)
Cleared to run unattended: not yet
Satisfies: R-10.1 to R-10.7

## Goal

Lifting numbers are half the picture. Taylor wants to see bodyweight move
over weeks without daily noise hiding the trend, keep height on record, and
track other measurements only when they matter. Metrics Taylor doesn't use
stay out of the way.

## Done when

- *Body screen.* A new **Body** tab. It lists bodyweight first, then height,
  then every switched-on metric, each with its latest value and date. Tapping
  one opens its page: an entry box with today's date (date can be changed),
  the history list newest first, and the chart. — demonstration
- *Bodyweight (R-10.1).* Log a value for any date; several dates, any gaps.
  One entry per date: entering a second value for the same date replaces it
  after a "Replace 182.4 lb?" confirm. Entries can be edited and deleted. —
  test
- *Height (R-10.2).* Height is one current value (feet and inches, or cm),
  shown on the Body screen and readable by other features (W-15 uses
  bodyweight; height is kept for later use). Changing it keeps the old values
  in its history. — test
- *Rolling average (R-10.3).* The bodyweight chart shows each real entry as a
  dot and a 7-day average line. The average on a date uses only entries on
  that date and the 6 days before it, and exists only on dates that have an
  entry (a gap stays a gap; no invented values). Worked example in the tests:
  entries on the 1st (180), 3rd (182) and 10th (179) give averages 180, 181
  and 179 (the 1st and 3rd fall outside the 10th's window). — test,
  demonstration
- *Optional metrics (R-10.4).* Settings → Body metrics lists: waist, chest,
  hips, upper arm, thigh, neck, calf, body fat %, progress photos, each with
  an on/off switch (all off at first), and **Add custom metric** (name and
  unit, such as "Resting HR", "bpm"). Switching one off hides it everywhere;
  its entries are kept and come back when it is switched on. Custom metrics
  can be renamed and switched off, never deleted while they hold entries. —
  test
- *Each metric has a history and chart (R-10.5).* Same page as bodyweight
  (list, entry box, chart with entries; the 7-day line is shown for
  bodyweight only). — test, demonstration
- *Photos (R-10.6).* With photos on, a Photos page: **Add photo** opens the
  iPhone camera or library. The photo is shrunk to at most 1600 pixels on the
  long side (JPEG) and stored in the app's database on the phone, never
  uploaded. Photos show by date, newest first; tap to see full size; can be
  deleted. W-07's backup includes them. The PR reports the measured size per
  photo and what that means for the backup file. — test, demonstration
- *Units (R-10.7).* Bodyweight stored in pounds, lengths in inches, at full
  precision; shown in kg and cm when the unit setting is kg. Switching back
  and forth changes no stored value. Body fat % and custom metrics are stored
  as typed. — test
- *Backup.* W-07's export and restore include the new tables (its "every
  table" test covers this). — test
- Controls are at least 44 × 44 points; phone-size screenshots of the Body
  screen, the bodyweight chart, Settings → Body metrics, and Photos. —
  demonstration
- The project's check command passes: `npm run check`

**Data shape** (next database version, with an upgrade that adds the built-in
metric definitions). `metrics`: id, name, kind (`weight`, `length`,
`percent`, `custom`), unit text for custom, built-in or not, on or off, order.
`metricEntries`: id, metricId, date, value (pounds, inches, % or as typed),
with an index on `[metricId+date]`. `photos`: id, date, image (Blob), width,
height, size in bytes. Bodyweight and height are built-in metrics that are
always on.

## Out of scope

Stats cards (W-12). Goals or target weights, BMI, body fat estimated from
measurements, comparing photos side by side, reading weight from Apple
Health (W-13), reminders to weigh in.

## Decisions already made

- Single user, data only on the phone ([decision 0001](../decisions/0001-stack-and-storage.md)); photos stay on the phone too.
- Units follow the lb/kg setting; height and measurements follow it as in/cm (Taylor, 2026-11-18).
- To be recorded: decision 0005, the metrics data shape (one generic metric
  table rather than a table per metric), because history, stats and backups
  build on it.

## Riskiest assumption

That photos stored as Blobs in IndexedDB on iPhone survive, stay within
Safari's storage allowance and go into the backup file at a sensible size.
Check first with a throwaway script in the desktop browser: store ten
1600-pixel JPEGs, measure the size, export them as base64 and import them
back byte for byte. Taylor's phone confirms storage at the next release.

## Slices

1. Data shape, upgrade, decision 0005; functions with tests (log, replace,
   edit, delete, rolling average with the worked example, switch on/off keeps
   data, custom metrics, units).
2. Body tab, metric page with list and entry box; Settings → Body metrics.
3. Chart with dots and the 7-day line (reuses W-08's chart if built).
4. Photos: spike, then capture, shrink, store, show, delete; backup check.
5. Screenshots, `npm run check`, review.

## Stop and ask if

- The photo spike shows backups would be unworkably large (more than about
  1 MB per photo after shrinking).
- A requirement looks wrong, or a test looks wrong.
- A new dependency or a secret is needed.
- The same failure happens twice.

## Acceptance script

Release 2 steps 5 to 7 and 9 in [verification-plan.md](../verification-plan.md).

## Questions for Taylor

1. Body metrics get their own **Body** tab (six tabs, each still wide enough
   to tap). W-12 would later put the Stats cards at the top of that tab and
   rename it **Stats**. OK, or would you rather reach Body from Today?
2. One bodyweight per day (a second one replaces the first). Or do you weigh
   in more than once a day and want both kept?
