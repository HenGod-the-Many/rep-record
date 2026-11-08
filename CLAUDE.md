# Workout Journal

Phone-first PWA for planning workouts, logging sets and journaling. Single user,
no backend: all data lives in the browser (IndexedDB via Dexie) with JSON
export/import for backup. Primary device is an iPhone (Safari / home-screen app).

## Where things are

- Status of work items: `docs/queue.md` (start here). Requirements: `docs/requirements.md`. Test plan: `docs/verification-plan.md`. Decisions: `docs/decisions/`. Journal: `docs/journal.md`.
- To start a session: "Use the work-item skill on the next item in `docs/queue.md`".
- App source: `src/` (data layer in `src/db/`)

## Commands

- `npm run dev`: local dev server
- `npm test`: unit tests (Vitest + fake-indexeddb)
- `npm run build`: type-check and production build
- `npm run check`: everything (type-check, tests, build); must pass before a PR

## Rules for this project

- History follows the exercise: every history/PR query keys on
  `SetLog.exerciseId`, never on a plan or split ID.
- Exercises are archived, never deleted.
- Weights are stored in pounds; the display unit is a setting.

## Git workflow

This repo uses main / dev / feature branches. See
[docs/git-workflow.md](docs/git-workflow.md); the rules Claude follows are in
`.claude/rules/git-workflow.md`.
