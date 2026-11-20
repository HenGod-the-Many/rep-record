import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ExerciseKind } from '../db/db';
import { formatDate, timeLabel } from '../db/dates';
import { chartPoints, exerciseHistory, records, type ChartPoint, type Mark } from '../db/history';
import { displayNumber, formatWeight, getUnit, type Unit } from '../db/units';
import { Header } from './common';
import { partsText } from './LogWorkout';

const SERIES: Record<ExerciseKind, { label: string; unit: 'weight' | 'reps' | 's' }[]> = {
  weight: [
    { label: 'Heaviest', unit: 'weight' },
    { label: 'Est. 1-rep max', unit: 'weight' },
  ],
  bodyweight: [{ label: 'Most reps', unit: 'reps' }],
  timed: [{ label: 'Longest hold', unit: 's' }],
};

function shortDate(date: string): string {
  return formatDate(date).split(' ').slice(1).join(' '); // "2 Nov"
}

function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * A small two-line chart drawn as SVG (no chart library). Dots for each date;
 * the x axis is spaced by real time so gaps between workouts show as gaps.
 */
export function Chart({ points, kind, unit }: { points: ChartPoint[]; kind: ExerciseKind; unit: Unit }) {
  const W = 340;
  const H = 180;
  const pad = { l: 44, r: 8, t: 10, b: 24 };
  const show = (v: number) => (SERIES[kind][0].unit === 'weight' ? Number(displayNumber(v, unit)) : v);
  const all = points.flatMap((p) => p.values.filter((v): v is number => v !== null).map(show));
  if (points.length === 0 || all.length === 0) return null;
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 1) {
    lo -= 5;
    hi += 5;
  }
  const span = hi - lo;
  lo = Math.max(0, lo - span * 0.08);
  hi = hi + span * 0.08;
  const t = (d: string) => Date.parse(`${d}T12:00:00Z`);
  const t0 = t(points[0].date);
  const t1 = t(points[points.length - 1].date);
  const x = (d: string) => (t1 === t0 ? pad.l + (W - pad.l - pad.r) / 2 : pad.l + ((t(d) - t0) / (t1 - t0)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (show(v) - lo) / (hi - lo)) * (H - pad.t - pad.b);
  // At most 4 date labels, spread across the axis.
  const labelIdx = points.length <= 4 ? points.map((_, i) => i) : [0, Math.round((points.length - 1) / 3), Math.round(((points.length - 1) * 2) / 3), points.length - 1];
  const colors = ['var(--accent)', 'var(--warn, #f0b54a)'];
  const fmt = (v: number) => String(Math.round(v));
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Progress chart">
        {[lo, (lo + hi) / 2, hi].map((v) => {
          const yy = pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
          return (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} className="chart-grid" />
              <text x={pad.l - 6} y={yy + 4} textAnchor="end" className="chart-label">
                {fmt(v)}
              </text>
            </g>
          );
        })}
        {SERIES[kind].map((_, si) => {
          const pts = points.filter((p) => p.values[si] !== null);
          return (
            <g key={si}>
              {pts.length > 1 && (
                <polyline fill="none" stroke={colors[si]} strokeWidth={2} points={pts.map((p) => `${x(p.date)},${y(p.values[si]!)}`).join(' ')} />
              )}
              {pts.map((p) => (
                <circle key={p.date} cx={x(p.date)} cy={y(p.values[si]!)} r={3} fill={colors[si]} />
              ))}
            </g>
          );
        })}
        {[...new Set(labelIdx)].map((i) => (
          <text key={i} x={x(points[i].date)} y={H - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="chart-label">
            {shortDate(points[i].date)}
          </text>
        ))}
      </svg>
      <figcaption className="chart-legend">
        {SERIES[kind].map((s, i) => (
          <span key={s.label}>
            <i style={{ background: colors[i] }} /> {s.label}
            {s.unit === 'weight' ? ` (${unit})` : s.unit === 's' ? ' (s)' : ''}
          </span>
        ))}
      </figcaption>
    </figure>
  );
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
  const r = records(history, kind);
  const points = chartPoints(history, kind);
  const latest = points.length ? points[points.length - 1].date : '';
  const shown = all || !latest ? points : points.filter((p) => p.date >= daysBefore(latest, 91));
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
              <Chart points={shown} kind={kind} unit={unit} />
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
