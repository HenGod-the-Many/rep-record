# W-20 tap counts, before and after

R-16.7's method is "tap counts re-measured against the audit". The "before" numbers come from the UI audit of v0.8.0 ([audit page](https://claude.ai/artifact/2PvXoTtXL2MpDM7hiS1tM3), counted from Today). The "after" numbers were counted on the W-20 build at 390 × 844, starting from Home, by following each path on screen on 2026-11-25.

Typing is not counted. "Scroll" means a scroll is needed on the way.

| Job | Before (v0.8.0) | After (W-20) | Path now |
|---|---|---|---|
| Start today's workout | 1 | 1 | Home → Start workout |
| Log a set (last time's numbers right) | 1 | 1 | Tick |
| Rate the set | 1 | 1 | 1–10 after the tick |
| Add bodyweight | 4 | **2** | Bodyweight tile → type → Save (Enter also saves) |
| Change an exercise's reps in a workout | 6 + scroll | **5 + scroll** | Library → folder → workout → scroll → exercise → reps box; it saves when you leave the box (no Save tap) |
| Move a day | 6 | **7** | Calendar → day → "…" → Move day… → date → pick → Move. One more tap because Move day now sits in the "…" menu, as R-16.7 asks for rare actions |
| See an exercise's history | 3 + scroll | **2** | Progress → the exercise (in "Exercises", most recent first); or Library → Exercises → scroll → exercise (3 + scroll) |
| Back up | 4 + scroll | 4 + scroll | Home gear → scroll → Back up data → share sheet → Save; when a backup is due, Home's reminder link replaces the gear tap |

Notes:

- "Change an exercise's reps" counts 1 more tap (5 + scroll → 6) if the Library opens on another section, because the Library reopens the section used last.
- The bodyweight count of 2 needs the iPhone to show the keyboard by itself when the box opens. The box opens straight from the tap so Safari allows it, but this is only checked on the phone (acceptance script step 2). If it doesn't, it is 3.
