import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatDate, todayLocal } from '../db/dates';
import { formatMetric } from '../db/body';
import {
  availableCards,
  bodyweightCard,
  chosenCards,
  finishedWorkouts,
  metricCard,
  monthRange,
  moveCard,
  recentPrs,
  setCardShown,
  setsBetween,
  volumeBetween,
  weekRange,
  type CardInfo,
} from '../db/stats';
import { displayNumber, formatWeight, getUnit, type Unit } from '../db/units';
import { navigate } from '../router';
import { attempt, ErrorText } from './common';

interface CardView {
  info: CardInfo;
  big: string | null;
  sub: string;
  empty: string;
  list?: { text: string; sub: string; to: string }[];
  to: string;
}

async function buildCard(info: CardInfo, unit: Unit, today: string): Promise<CardView> {
  const wk = await weekRange(db, today);
  switch (info.id) {
    case 'workouts-week': {
      const n = await finishedWorkouts(db, wk.from, wk.to);
      return { info, big: n ? String(n) : null, sub: `${formatDate(wk.from)} – ${formatDate(wk.to)}`, empty: 'No workouts this week', to: '/calendar' };
    }
    case 'workouts-month': {
      const mo = monthRange(today);
      const n = await finishedWorkouts(db, mo.from, mo.to);
      return { info, big: n ? String(n) : null, sub: 'This calendar month', empty: 'No workouts this month', to: `/calendar?m=${today.slice(0, 7)}` };
    }
    case 'sets-week': {
      const n = await setsBetween(db, wk.from, wk.to);
      return { info, big: n ? String(n) : null, sub: 'Lifting sets logged', empty: 'No sets this week', to: '/calendar' };
    }
    case 'volume-week': {
      const lb = await volumeBetween(db, wk.from, wk.to);
      return {
        info,
        big: lb ? `${Number(displayNumber(lb, unit)).toLocaleString()} ${unit}` : null,
        sub: 'Weight × reps, weight exercises only (bodyweight and timed sets are left out)',
        empty: 'No weight sets this week',
        to: '/calendar',
      };
    }
    case 'recent-prs': {
      const prs = await recentPrs(db, 5);
      return {
        info,
        big: null,
        sub: '',
        empty: 'No new records yet. A first session sets the starting mark.',
        list: prs.map((p) => ({
          text: `${p.name} · ${p.record === 'heaviest' ? 'heaviest' : 'est. 1-rep max'} ${formatWeight(p.valueLb, unit)}`,
          sub: formatDate(p.date),
          to: `/exercises/${p.exerciseId}/history?back=${encodeURIComponent('/body')}`,
        })),
        to: '/exercises',
      };
    }
    case 'bodyweight': {
      const b = await bodyweightCard(db);
      return {
        info,
        big: b ? formatWeight(b.valueLb, unit) : null,
        sub: b ? `${formatDate(b.date)} · 7-day average ${formatWeight(b.averageLb, unit)}` : '',
        empty: 'No bodyweight yet',
        to: '/body/bodyweight',
      };
    }
    default: {
      const id = info.id.replace(/^metric:/, '');
      const m = await metricCard(db, id);
      return {
        info,
        big: m && m.value !== null ? formatMetric(m.metric, m.value, unit) : null,
        sub: m && m.date ? formatDate(m.date) : '',
        empty: `No ${info.label.toLowerCase()} yet`,
        to: `/body/${id}`,
      };
    }
  }
}

/** The cards at the top of the Stats tab (W-12), with Edit cards. */
export function StatsCards() {
  const today = todayLocal();
  const data = useLiveQuery(async () => {
    const unit = await getUnit(db);
    const chosen = await chosenCards(db);
    return { cards: await Promise.all(chosen.map((c) => buildCard(c, unit, today))), available: await availableCards(db) };
  }, [today]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;

  if (editing) {
    const shownIds = data.cards.map((c) => c.info.id);
    const hidden = data.available.filter((c) => !shownIds.includes(c.id));
    return (
      <section className="stack" aria-label="Edit cards">
        <div className="section-head">
          <h2>Edit cards</h2>
          <button className="btn-primary small-btn" onClick={() => setEditing(false)}>Done</button>
        </div>
        <ul className="list edit-cards">
          {data.cards.map((c, i) => (
            <li key={c.info.id} className="edit-card-row">
              <label className="switch-label">
                <input type="checkbox" checked onChange={() => attempt(() => setCardShown(db, c.info.id, false), setError)} />
                <span>{c.info.label}</span>
              </label>
              <button className="icon-btn" aria-label={`Move ${c.info.label} up`} disabled={i === 0} onClick={() => attempt(() => moveCard(db, c.info.id, -1), setError)}>↑</button>
              <button className="icon-btn" aria-label={`Move ${c.info.label} down`} disabled={i === data.cards.length - 1} onClick={() => attempt(() => moveCard(db, c.info.id, 1), setError)}>↓</button>
            </li>
          ))}
          {hidden.map((c) => (
            <li key={c.id} className="edit-card-row">
              <label className="switch-label">
                <input type="checkbox" checked={false} onChange={() => attempt(() => setCardShown(db, c.id, true), setError)} />
                <span className="muted">{c.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <ErrorText message={error} />
      </section>
    );
  }

  return (
    <section aria-label="Stats cards">
      <div className="section-head">
        <h2>Overview</h2>
        <button className="link" onClick={() => setEditing(true)}>Edit cards</button>
      </div>
      {data.cards.length === 0 && <p className="muted">No cards shown. Tap Edit cards to pick some.</p>}
      <div className="stat-cards">
        {data.cards.map((c) =>
          c.list ? (
            <div key={c.info.id} className="card stat-card wide">
              <div className="stat-label">{c.info.label}</div>
              {c.list.length === 0 ? (
                <p className="muted small-print">{c.empty}</p>
              ) : (
                <ul className="pr-list">
                  {c.list.map((p, i) => (
                    <li key={i}>
                      <button className="pr-row" onClick={() => navigate(p.to)}>
                        <span>{p.text}</span>
                        <span className="muted">{p.sub}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <button key={c.info.id} className="card stat-card" onClick={() => navigate(c.to)}>
              <span className="stat-label">{c.info.label}</span>
              {c.big ? <span className="stat-big">{c.big}</span> : <span className="muted small-print">{c.empty}</span>}
              {c.big && c.sub && <span className="stat-sub">{c.sub}</span>}
            </button>
          ),
        )}
      </div>
    </section>
  );
}
