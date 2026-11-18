# 0001 Stack and storage

Status: Proposed 2026-11-08; Taylor approved the stack in principle ("Yes,
start"); in force since the requirements were approved on 2026-11-18.

## Context

A single-user app used on an iPhone at the gym with poor wifi. No backend for
v1. Data must survive offline use and be exportable.

## Decision

- **App:** installable web app (PWA) with React, TypeScript and Vite, hosted on
  GitHub Pages (Taylor has GitHub Pro, so a private repo can publish).
- **Storage:** IndexedDB on the device through Dexie. The app asks the browser
  for persistent storage. JSON export/import is the backup.
- **Runtime dependencies:** `react`, `react-dom`, `dexie`, `dexie-react-hooks`.
  Build/test only: `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa`,
  `typescript`, `vitest`, `fake-indexeddb`. Routing is a small hash router in
  the app (works on GitHub Pages without server rewrites).
- **Data model:**
  - `exercises`: id, name, muscleGroup, equipment, kind (`weight` | `bodyweight` | `timed`), archived
  - `plans`: id, name, notes
  - `planExercises`: id, planId, exerciseId, order, targetSets, repMin, repMax, alternateIds[]
  - `splits`: id, name, cycleDays
  - `splitDays`: id, splitId, dayIndex (0…cycleDays−1), planId (null = rest)
  - `schedules`: id, splitId, startDate, lengthDays, createdAt
  - `dateOverrides`: date, planId (null = rest)
  - `sessions`: id, date, planId, planName (snapshot), splitId, journalNote
  - `setLogs`: id, sessionId, exerciseId, planExerciseId (the slot it filled, optional), setNumber, weightLb, reps, seconds, note
  - `dayNotes`: date, energy, sleep, soreness, note
  - `settings`: key, value (e.g. unit = lb | kg)
- **History rule:** every history, PR and pre-fill query keys on
  `setLogs.exerciseId`, never on a plan or split ID.
- **Weights** are stored in pounds at full precision; kg is converted for display.

## Rejected

- **SQLite in the browser (WASM):** a much larger download and more storage
  plumbing for no gain at one user's data size.
- **A backend with accounts:** the brief rules it out for v1, and it adds hosting
  cost and a login step at the gym.
- **The brief's weekday-based split (weekday 0–6):** replaced by Taylor's cycle
  model (cycle length plus a scheduled start date), which also covers 7-day splits.
- **Netlify / Cloudflare Pages:** free, but GitHub Pages needs no new account.
