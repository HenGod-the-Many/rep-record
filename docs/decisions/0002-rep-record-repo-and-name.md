# 0002 Move to the rep-record repo and rename the app Rep Record

Status: Decided by Taylor, 2026-11-18.

## Context

The project was set up against `HenGod-the-Many/workout-journal`, but the first
build was never pushed there. Taylor created a new public repo,
`HenGod-the-Many/rep-record`, holding only a placeholder README, and asked for
the project to live there.

## Decision

- `origin` is `https://github.com/HenGod-the-Many/rep-record.git`. Our history
  replaces the placeholder README commit (Taylor's choice).
- The app is called **Rep Record**: page title, home-screen name and manifest.
  The site will be served at `https://hengod-the-many.github.io/rep-record/`,
  so the build's base path is `/rep-record/`.
- The internal browser database keeps the name `workout-journal`. Nobody sees
  it, and keeping it means no data migration code is needed.
- The old `workout-journal` repo is archived (read-only, reversible).

## Rejected

- **Merging the placeholder README's history into ours:** adds a meaningless
  join at the start of the history. Taylor chose a clean replace.
- **Renaming the database too:** no benefit to the user, and it risks
  orphaning data if a test install already exists.
