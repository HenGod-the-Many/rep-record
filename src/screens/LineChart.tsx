import { daysBetween } from '../db/dates';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2 Nov". */
function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTH_SHORT[m - 1]}`;
}

export interface Series {
  label: string;
  /** 'line' joins the points, 'dots' shows only points, 'both' does both. */
  style: 'line' | 'dots' | 'both';
}

export interface Point {
  date: string;
  /** One value per series, already in the unit shown; null where a series has no value that date. */
  values: (number | null)[];
}

const COLORS = ['var(--accent)', 'var(--chart-2)'];

/**
 * A small chart drawn as SVG (no chart library), shared by exercise history
 * (W-08) and body metrics (W-11). The x axis is spaced by real time. With
 * `gapDays`, a line is broken where two points are further apart than that,
 * so a long gap in entries shows as a gap.
 */
export function LineChart({ points, series, unitLabel, gapDays }: { points: Point[]; series: Series[]; unitLabel: string; gapDays?: number }) {
  const W = 340;
  const H = 180;
  const pad = { l: 44, r: 8, t: 10, b: 24 };
  const all = points.flatMap((p) => p.values.filter((v): v is number => v !== null));
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
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const labelIdx = points.length <= 4 ? points.map((_, i) => i) : [0, Math.round((points.length - 1) / 3), Math.round(((points.length - 1) * 2) / 3), points.length - 1];

  /** Runs of consecutive points with a value, split where the gap is too long. */
  const runs = (si: number) => {
    const out: Point[][] = [];
    let cur: Point[] = [];
    for (const p of points) {
      if (p.values[si] === null) continue;
      const prev = cur[cur.length - 1];
      if (prev && gapDays !== undefined && daysBetween(prev.date, p.date) > gapDays) {
        out.push(cur);
        cur = [];
      }
      cur.push(p);
    }
    if (cur.length) out.push(cur);
    return out;
  };

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Progress chart">
        {[lo, (lo + hi) / 2, hi].map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="chart-label">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {series.map((s, si) => (
          <g key={si}>
            {s.style !== 'dots' &&
              runs(si)
                .filter((r) => r.length > 1)
                .map((r, ri) => (
                  <polyline key={ri} fill="none" stroke={COLORS[si]} strokeWidth={2} points={r.map((p) => `${x(p.date)},${y(p.values[si]!)}`).join(' ')} />
                ))}
            {s.style !== 'line' &&
              points
                .filter((p) => p.values[si] !== null)
                .map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.values[si]!)} r={3} fill={COLORS[si]} />)}
          </g>
        ))}
        {[...new Set(labelIdx)].map((i) => (
          <text key={i} x={x(points[i].date)} y={H - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="chart-label">
            {shortDate(points[i].date)}
          </text>
        ))}
      </svg>
      <figcaption className="chart-legend">
        {series.map((s, i) => (
          <span key={s.label}>
            <i style={{ background: COLORS[i] }} /> {s.label}
            {unitLabel ? ` (${unitLabel})` : ''}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
