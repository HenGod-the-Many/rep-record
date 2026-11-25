# W-18: Plan folders and copying

Status: approved by Taylor 2026-11-24 ("approve all of those defaults and builds"), with every default answer.
Cleared to run unattended: yes
Satisfies: R-02.5, R-02.6 (new)

## Goal

As plans pile up (a push/pull/legs block, a kettlebell block, a travel set),
one long list gets hard to use. Folders keep them in groups, and copying a
whole folder starts the next training block in one step.

## Done when

- *Folders (R-02.5).* The Plans tab shows folders, then plans not in any
  folder. You can create, rename, reorder and delete a folder, and move a plan
  into a folder or out of one. A plan is in one folder at most. Deleting a
  folder keeps its plans (they move out of it) after a confirm that says so.
  Splits and the calendar are unaffected by folders. — test, demonstration
- *Copying (R-02.6).* **Duplicate** on a plan makes an independent copy in the
  same folder, as today (R-02.3). **Duplicate** on a folder makes a new folder
  "<name> (copy)" holding independent copies of every plan in it, with their
  targets, alternates and warm-ups. Editing a copy never changes the original.
  — test
- *Warm-ups are easy to find.* Warm-up routines get their own row at the top
  of the Plans tab ("Warm-ups · 3 routines") instead of the small header link.
  — demonstration
- *Backup.* W-07's export and restore include folders. — test
- Controls are at least 44 × 44 points; phone-size screenshots of the Plans
  tab with folders, an open folder and the move-to-folder choice.
  — demonstration
- The project's check command passes: `npm run check`

**Data shape.** New table `folders`: id, name, order. `Plan` gains `folderId`
(or null). Existing plans start outside any folder.

## Out of scope

Folders inside folders; folders for exercises or warm-ups; copying a split.

## Riskiest assumption

That one level of folders is enough. Nested folders are much more work to
build and to use on a phone screen.

## Slices

1. `folders` table, upgrade, functions with tests (move, delete keeps plans,
   duplicate folder).
2. Plans tab with folders, Warm-ups row, move and duplicate controls.
3. Screenshots, `npm run check`, review.

## Stop and ask if

- A requirement looks wrong, or a test looks wrong.
- The same failure happens twice.

## Acceptance script

1. Create a folder "Block A" and move two plans into it.
2. Duplicate the folder. Edit a plan in the copy; the original is unchanged.
3. Delete the copied folder; its plans are still listed, outside any folder.
4. Open Warm-ups from its row at the top of Plans.

## Answers (Taylor approved the defaults 2026-11-24)

1. One level of folders, or folders inside folders? Default: **one level**.
2. When a folder is deleted, keep its plans or delete them too? Default:
   **keep them**.
