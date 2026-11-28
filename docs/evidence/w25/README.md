# W-25 evidence

Screenshots at 375 x 812 (iPhone size) from the dev server with test data, 2026-11-27.

| File | Shows | Requirement |
|---|---|---|
| timer-stopped-light.jpg, timer-stopped-dark.jpg | The timer at the top of the logging screen, stopped by itself at the last target set (20:54 after an extra set) | R-17.1, R-17.2 |
| timer-held-dark.jpg | A running workout with no set ticked for 15 minutes: the clock holds, "Held: no set for 15 min", with Pause | R-17.1, answer 9 |
| home-about-min-light.jpg, home-about-min-dark.jpg | Home's workout card "about 4 min"; minutes exercised from the timer (33) | R-17.4, R-17.5 |
| library-about-min-light.jpg, library-about-min-dark.jpg | Library workout rows with "about N min" | R-17.4 |
| history-average-light.jpg, history-average-dark.jpg | An exercise's history with "Average time · about 1 min · last 5 workouts" | R-17.4 |
| exercise-edit-light.jpg | Exercise edit with no Save button: "Changes save when you leave a box." | R-17.6 |

Real data: `node scripts/timing-report.mjs <backup>` on Taylor's backup of 2026-11-27 (3 workouts, 41 sets; the file is not in the repo): Push 24 Nov 69:14, Pull 25 Nov 60:52.
