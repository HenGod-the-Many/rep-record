// Runs the W-25 timing model over a Rep Record backup file and prints what it
// gives for every logged workout: workout time, time per exercise, time per set.
// Used in W-25 slice 1 to check the model against real workouts before any
// screen is built.
//
//   node scripts/timing-report.mjs path/to/rep-record-backup.json
//
// Reads the file only; changes nothing. Needs Node 23.6 or later (runs the
// TypeScript model directly).
import { readFileSync } from 'node:fs';
import { countedMs, exerciseTimes, MAX_SET_MS, setTimes, workoutMs } from '../src/db/timing.ts';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/timing-report.mjs <backup.json>');
  process.exit(1);
}
const backup = JSON.parse(readFileSync(file, 'utf8'));
const t = backup.tables ?? {};
const exercises = new Map((t.exercises ?? []).map((e) => [e.id, e]));
const kindOf = (id) => exercises.get(id)?.kind ?? 'weight';
const nameOf = (id) => exercises.get(id)?.name ?? '(unknown exercise)';

const clock = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const timeOfDay = (ms) => new Date(ms).toTimeString().slice(0, 8);
const setText = (s) =>
  s.parts.map((p) => (p.seconds != null && p.reps == null ? `${p.seconds}s` : `${p.reps ?? '?'}${p.weightLb != null ? `x${Math.round(p.weightLb * 10) / 10}` : ''}`)).join('+');

const sessions = [...(t.sessions ?? [])].sort((a, b) => (a.date === b.date ? a.startedAt - b.startedAt : a.date < b.date ? -1 : 1));
const logs = t.setLogs ?? [];
let capped = 0;
let total = 0;
for (const s of sessions) {
  const sets = logs.filter((l) => l.sessionId === s.id).sort((a, b) => a.loggedAt - b.loggedAt);
  if (!sets.length && s.finishedAt === null) continue;
  const perSet = setTimes(s, sets, kindOf);
  const perEx = exerciseTimes(s, sets, kindOf);
  const finished = s.finishedAt !== null ? `finished ${timeOfDay(s.finishedAt)}` : 'never finished';
  console.log(`\n=== ${s.date} ${s.planName || '(no name)'}: started ${timeOfDay(s.startedAt)}, ${finished}`);
  console.log(`    workout time ${clock(workoutMs(s, sets, kindOf))} (counts ${clock(countedMs(s, sets, kindOf))} toward minutes exercised)`);
  if (s.finishedAt !== null) console.log(`    old rule (start to Finish): ${clock(Math.max(0, s.finishedAt - s.startedAt))}`);
  for (const [id, ms] of perEx) console.log(`    ${clock(ms).padStart(6)}  ${nameOf(id)}`);
  console.log('    sets (tick time, given time, set):');
  for (const l of sets) {
    const ms = perSet.get(l.id) ?? 0;
    total++;
    if (ms >= MAX_SET_MS && kindOf(l.exerciseId) !== 'activity') capped++;
    const flag = ms >= MAX_SET_MS && kindOf(l.exerciseId) !== 'activity' ? '  <- 5 min limit' : ms < 10_000 ? '  <- under 10 s' : '';
    console.log(`      ${timeOfDay(l.loggedAt)}  ${clock(ms).padStart(6)}  ${nameOf(l.exerciseId)} #${l.setNumber} ${setText(l)}${flag}`);
  }
}
console.log(`\n${sessions.length} workouts, ${total} sets, ${capped} sets at the 5-minute limit.`);
