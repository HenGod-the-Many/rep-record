import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type PlanExercise, type Session, type SetLog } from '../db/db';
import { caloriesFor, distanceUnit, formatDistance, formatDuration, fromShownDistance, lastActivity, logActivity, toShownDistance } from '../db/activities';
import type { Unit } from '../db/units';
import { formatTargets } from '../format';
import { navigate } from '../router';
import { attempt, CardTitle, ErrorText, MoveButtons, type SlotControls } from './common';
import { SwapPanel } from './LogWorkout';

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * An activity in the logging screen (W-15): one row instead of sets. Duration
 * (± 5 min) and distance (± 0.5, hidden when the activity has none), a ✓ to log,
 * and under "More": effort 1–10, average heart rate and calories. Pre-filled from
 * the last time this activity was logged, in any plan.
 */
export function ActivityCard(props: { session: Session; entry: PlanExercise; exercise: Exercise; original: Exercise | undefined; log: SetLog | undefined; unit: Unit; controls?: SlotControls }) {
  const { session, entry, exercise, log, unit, controls } = props;
  const last = useLiveQuery(async () => (await lastActivity(db, session.id, exercise.id)) ?? null, [session.id, exercise.id]);
  const calories = useLiveQuery(async () => (log ? caloriesFor(db, log, exercise, session.date) : null), [log, exercise, session.date]);

  const [minutes, setMinutes] = useState('');
  const [distance, setDistance] = useState('');
  const [effort, setEffort] = useState<number | null>(null);
  const [hr, setHr] = useState('');
  const [kcal, setKcal] = useState('');
  const [more, setMore] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [filled, setFilled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill the boxes once: from this workout's log if there is one, else last time, else the plan's target.
  useEffect(() => {
    if (filled || last === undefined) return;
    const src = log ?? last;
    const secs = src?.parts[0]?.seconds;
    setMinutes(String(secs ? Math.round(secs / 60) : entry.repMin));
    const mi = src?.distanceMi ?? entry.targetDistanceMi ?? null;
    setDistance(exercise.hasDistance && mi ? String(round1(toShownDistance(mi, unit))) : '');
    if (log) {
      setEffort(log.difficulty);
      setHr(log.avgHr ? String(log.avgHr) : '');
      setKcal(log.calories ? String(log.calories) : '');
    }
    setFilled(true);
  }, [filled, last, log, entry, exercise.hasDistance, unit]);

  const step = (value: string, by: number, min: number) => String(round1(Math.max(min, (Number(value.replace(',', '.')) || 0) + by)));

  const save = async () => {
    const first = !log;
    const ok = await attempt(
      () =>
        logActivity(db, {
          sessionId: session.id,
          exerciseId: exercise.id,
          planExerciseId: entry.id,
          seconds: Math.round(Number(minutes.replace(',', '.')) * 60),
          distanceMi: !exercise.hasDistance || !distance.trim()
            ? null
            : log?.distanceMi && String(round1(toShownDistance(log.distanceMi, unit))) === distance.trim()
              ? log.distanceMi // unchanged on screen: keep the stored miles, don't round them
              : fromShownDistance(Number(distance.replace(',', '.')), unit),
          difficulty: effort,
          avgHr: hr.trim() ? Number(hr) : null,
          calories: kcal.trim() ? Number(kcal) : null,
        }),
      setError,
    );
    // Logging an activity for the first time finishes it, so it folds (W-17).
    if (ok && first) controls?.onComplete?.();
  };

  const lastLine = last
    ? `last: ${formatDuration(last.parts[0]?.seconds ?? 0)}${last.distanceMi ? ` · ${formatDistance(last.distanceMi, unit)}` : ''}${last.difficulty ? ` · effort ${last.difficulty}/10` : ''}`
    : `target ${formatTargets(entry, 'activity', unit)}`;

  return (
    <section className="card exercise-card activity-card">
      <div className="ex-head">
        <div>
          <CardTitle name={exercise.name} controls={controls} />
          <div className="row-sub">{formatTargets(entry, 'activity', unit)}</div>
        </div>
        <button className="btn-secondary small-btn" onClick={() => setSwapping(!swapping)} aria-expanded={swapping}>Swap</button>
      </div>
      {swapping && (
        <SwapPanel session={session} entry={entry} current={exercise.id} original={props.original} onDone={() => setSwapping(false)} />
      )}
      <div className="activity-head">
        <p className="small-print muted">{lastLine}</p>
        <button className={`check-btn${log ? ' done' : ''}`} aria-label={log ? 'Update activity' : 'Log activity'} onClick={save}>✓</button>
      </div>
      <div className="activity-row">
        <div className="stepper-box">
          <button className="step-btn" aria-label="5 minutes less" onClick={() => setMinutes(step(minutes, -5, 1))}>−</button>
          <label className="step-value">
            <input inputMode="decimal" aria-label="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            <span className="step-unit">min</span>
          </label>
          <button className="step-btn" aria-label="5 minutes more" onClick={() => setMinutes(step(minutes, 5, 1))}>+</button>
        </div>
        {exercise.hasDistance && (
          <div className="stepper-box">
            <button className="step-btn" aria-label="Less distance" onClick={() => setDistance(step(distance, -0.5, 0))}>−</button>
            <label className="step-value">
              <input inputMode="decimal" aria-label={`Distance in ${distanceUnit(unit)}`} value={distance} onChange={(e) => setDistance(e.target.value)} />
              <span className="step-unit">{distanceUnit(unit)}</span>
            </label>
            <button className="step-btn" aria-label="More distance" onClick={() => setDistance(step(distance, 0.5, 0))}>+</button>
          </div>
        )}
      </div>

      {log && calories && (
        <p className="calories-line">
          {calories.kcal !== null ? (
            calories.estimated ? (
              <>≈ {calories.kcal} kcal <span className="muted">(estimate)</span></>
            ) : (
              <>{calories.kcal} kcal</>
            )
          ) : (
            <>
              Enter your bodyweight to estimate calories.{' '}
              <button className="link" onClick={() => navigate('/body/bodyweight')}>Add bodyweight</button>
            </>
          )}
        </p>
      )}

      <button className="link more-toggle" aria-expanded={more} onClick={() => setMore(!more)}>{more ? 'Less' : 'More: effort, heart rate, calories'}</button>
      {more && (
        <div className="stack">
          <div className="diff-picker" role="group" aria-label="Effort, 1 easy to 10 all-out">
            <div className="diff-grid">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => (
                <button key={d} className={effort === d ? 'active' : ''} aria-pressed={effort === d} onClick={() => setEffort(effort === d ? null : d)}>{d}</button>
              ))}
            </div>
            <div className="diff-foot muted"><span>Effort: 1 easy · 10 all-out</span></div>
          </div>
          <div className="field-pair">
            <label className="field">
              <span>Avg heart rate</span>
              <input inputMode="numeric" value={hr} placeholder="bpm" onChange={(e) => setHr(e.target.value)} />
            </label>
            <label className="field">
              <span>Calories</span>
              <input inputMode="numeric" value={kcal} placeholder="kcal" onChange={(e) => setKcal(e.target.value)} />
            </label>
          </div>
          <p className="small-print muted">Leave calories empty to see an estimate from your bodyweight. Tap ✓ to save changes.</p>
        </div>
      )}
      {controls && (
        <div className="card-foot">
          <MoveButtons name={exercise.name} controls={controls} />
        </div>
      )}
      <ErrorText message={error} />
    </section>
  );
}
