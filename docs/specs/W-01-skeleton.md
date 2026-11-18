# W-01 Walking skeleton

**What it is for.** The thinnest app that runs end to end: it opens on a phone,
creates its local database, loads the brief's seed data, and has one command
that runs every check. Every later item builds on it.

**Done when.**
- `npm run check` runs type-check, unit tests and a production build, and fails
  if any of them fail.
- On first launch the database holds the brief's exercises (R-01.1), five plans
  with exact targets (R-02.2) and the default 7-day split (R-03.2). Unit tests
  check each against the brief.
- Seeding runs once: reopening the app does not duplicate anything (test).
- The built app has a web app manifest and service worker so it can be added to
  the home screen and load offline (checked in W-02 on the phone).
- The data model follows [decisions/0001](../decisions/0001-stack-and-storage.md):
  history keys on `SetLog.exerciseId`.

**Out of scope.** Screens beyond a navigation shell; hosting (W-02).

**Riskiest assumption.** IndexedDB behaves the same under the test library
(fake-indexeddb) as in Safari. Mitigated by the W-02 phone test.

**Stop and ask.** A runtime dependency not listed in decision 0001.
