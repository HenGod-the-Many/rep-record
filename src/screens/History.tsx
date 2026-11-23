import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ExerciseKind } from '../db/db';
import { addDays, formatDate, timeLabel, todayLocal } from '../db/dates';
import { chartPoints, exerciseHistory, records, type ChartPoint, type Mark } from '../db/history';
import { displayNumber, formatWeight, getUnit, type Unit } from '../db/units';
import { Header } from './common';
import { LineChart, type Point } from './LineChart';
import { partsText } from './LogWorkout';


const SERIES: Record<ExerciseKind, { label: string; weight: boolean; unit: string }[]> = {
  weight: [
    { label: 'Heaviest', weight: true, unit: '' },
    { label: 'Est. 1-rep max', weight: true, unit: '' },
  ],
  bodyweight: [{ label: 'Most reps', weight: false, unit: '' }],
  timed: [{ label: 'Longest hold', weight: false, unit: 's' }],
  activity: [{ label: 'Duration', weight: false, unit: 'min' }],
};

/** Chart points in the unit shown: weights converted to kg when that is the setting. */
function shownPoints(points: ChartPoint[], kind: ExerciseKind, unit: Unit): Point[] {
  const w = SERIES[kind][0].weight;
  return points.map((p) => ({ date: p.date, values: p.values.map((v) => (v === null || !w ? v : Number(displayNumber(v, unit)))) }));
}

function MarkLine({ label, mark, text }: { label: string; mark: Mark | null; text: (m: Mark) => string }) {
  return (
    <div className="record">
      <span className="muted">{label}</span>
      <strong>{mark ? text(mark) : '—'}</strong>
      {mark && <span className="muted small-print">{mark.date ? formatDate(mark.date) : ''}</span>}
    </div>
  );
}

/** An exercise's whole history (W-08): records, chart, and every set by workout. */
export function History({ exerciseId, back }: { exerciseId: string; back: string }) {
  const data = useLiveQuery(async () => {
    const exercise = await db.exercises.get(exerciseId);
    if (!exercise) return null;
    return { exercise, history: await exerciseHistory(db, exerciseId), unit: await getUnit(db) };
  }, [exerciseId]);
  const [all, setAll] = useState(false);
  const summary = useMemo(
    () => (data ? { r: records(data.history, data.exercise.kind), points: chartPoints(data.history, data.exercise.kind) } : null),
    [data],
  );

  if (data === undefined) return <div className="screen"><Header title="History" back={back} /></div>;
  if (data === null) {
    return (
      <div className="screen">
        <Header title="History" back={back} />
        <p className="muted">This exercise no longer exists.</p>
      </div>
    );
  }
  const { exercise, history, unit } = data;
  const kind = exercise.kind;
  const { r, points } = summary!;
  const from = addDays(todayLocal(), -91);
  const shown = all ? points : points.filter((p) => p.date >= from);
  const wt = (lb: number) => formatWeight(lb, unit);

  return (
    <div className="screen">
      <Header title={exercise.name} back={back} />
      {history.length === 0 ? (
        <p className="banner">No sets logged yet.</p>
      ) : (
        <>
          <section className="card records" aria-label="Records">
            {kind === 'weight' && (
              <>
                <MarkLine label="Heaviest" mark={r.heaviest} text={(m) => `${wt(m.value)} × ${m.reps}`} />
                <MarkLine label="Best est. 1-rep max" mark={r.bestE1rm} text={(m) => `${wt(m.value)} (${wt(m.weightLb!)} × ${m.reps})`} />
              </>
            )}
            {kind === 'bodyweight' && (
              <>
                <MarkLine label="Most reps in a set" mark={r.mostReps} text={(m) => `${m.value} reps`} />
                {r.heaviest && <MarkLine label="Heaviest added" mark={r.heaviest} text={(m) => `+${wt(m.value)} × ${m.reps}`} />}
              </>
            )}
            {kind === 'timed' && <MarkLine label="Longest hold" mark={r.longest} text={(m) => `${m.value} s`} />}
          </section>

          {points.length > 0 && (
            <section className="card">
              <div className="chart-head">
                <span className="card-title">Progress</span>
                <div className="segmented two small">
                  <button className={!all ? 'active' : ''} aria-pressed={!all} onClick={() => setAll(false)}>
                    3 months
                  </button>
                  <button className={all ? 'active' : ''} aria-pressed={all} onClick={() => setAll(true)}>
                    All
                  </button>
                </div>
              </div>
              {shown.length ? (
                <LineChart
                  points={shownPoints(shown, kind, unit)}
                  series={SERIES[kind].map((x) => ({ label: x.label, style: 'both' as const }))}
                  unitLabel={SERIES[kind][0].weight ? unit : SERIES[kind][0].unit}
                />
              ) : (
                <p className="small-print muted">Nothing logged in the last 3 months. Tap All to see everything.</p>
              )}
            </section>
          )}

          {history.map(({ session, sets }) => (
            <section key={session.id} className="card history-session">
              <div className="card-title">
                {session.date ? formatDate(session.date) : 'Unknown date'}
                <span className="row-sub">
                  {session.planName}
                  {session.time ? ` · ${timeLabel(session.time)}` : ''}
                </span>
              </div>
              <ol className="history-sets">
                {sets.map((s) => (
                  <li key={s.id}>
                    <span className="muted">Set {s.setNumber}</span> {partsText(s.parts, kind, unit)}
                    {s.difficulty !== null && <span className="muted"> · {s.difficulty}/10</span>}
                    {s.toFailure && <span className="muted"> · to failure</span>}
                  </li>
                ))}
              </ol>
              {session.journalNote && <p className="small-print muted">{session.journalNote}</p>}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
