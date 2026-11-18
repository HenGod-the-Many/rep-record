# W-03 Exercise library and W-04 Plan builder

Brief build step 2. Two items, one spec, because the plan builder is mostly the
library seen through a plan.

**What it is for.** Taylor can see and manage every exercise, and assemble and
change the plans the split will use, on the phone.

**Done when.**
- *Library (W-03).* A list of active exercises grouped by muscle group, with a
  search box. Create and edit name, muscle group, equipment and kind (R-01.2).
  Archive hides an exercise from the list and the plan picker; a "Show
  archived" toggle shows them and allows restore; no delete control exists
  (R-01.3). Saving a duplicate name is refused with a message (R-01.4).
- *Plans (W-04).* A list of plans. Opening a plan shows its exercises in order
  with "sets × min–max" (seconds for timed). You can add an exercise from the
  library, remove one, move one up or down, and edit its targets (R-02.1).
  "Duplicate" creates "<name> (copy)" with its own entries (R-02.3). Each entry
  can hold alternates, and the seeded "A or B" entries already do (R-02.4).
  "Replace" swaps the entry's exercise permanently; sets already logged for the
  old exercise are untouched (R-04.2).
- Every rule above that the data layer enforces has a unit test.
- Phone-size (390 × 844) screenshots of each screen, and every button at least
  44 × 44 points.

**Out of scope.** Splits, scheduling, logging, history screens.

**Riskiest assumption.** None beyond W-01's.

**Stop and ask.** A requirement here turns out to conflict with the brief.
