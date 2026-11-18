import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatMonth, monthGrid, shiftMonth, todayLocal, weekdayName } from '../db/dates';
import { getWeekStart, loadCalendar, resolveFrom } from '../db/schedule';
import { navigate } from '../router';
import { Header } from './common';
import { UndoBar } from './pickers';

/** First word of a plan name keeps calendar cells readable: "Chest, Back, Arms" -> "Chest". */
function shortName(name: string) {
  return name.split(/[ ,&]+/)[0] || name;
}

export function Calendar({ month }: { month: string }) {
  const today = todayLocal();
  const data = useLiveQuery(async () => {
    const [weekStart, cal, plans] = await Promise.all([getWeekStart(db), loadCalendar(db), db.plans.toArray()]);
    const names = new Map(plans.map((p) => [p.id, p.name]));
    const days = monthGrid(month, weekStart).map((d) => ({ ...resolveFrom(cal, d), names: [] as string[] }));
    for (const d of days) d.names = d.workouts.map((w) => shortName(names.get(w.planId) ?? '?'));
    return { weekStart, days };
  }, [month]);

  const go = (m: string) => navigate(`/calendar?m=${m}`, { replace: true });

  return (
    <div className="screen">
      <Header title="Calendar" />
      <UndoBar />
      <div className="month-nav">
        <button className="btn-secondary" aria-label="Previous month" onClick={() => go(shiftMonth(month, -1))}>‹</button>
        <h2>{formatMonth(month)}</h2>
        <button className="btn-secondary" aria-label="Next month" onClick={() => go(shiftMonth(month, 1))}>›</button>
      </div>
      {data && (
        <div className="cal-grid" role="grid">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="cal-head">{weekdayName((data.weekStart + i) % 7)}</div>
          ))}
          {data.days.map((d) => {
            const inMonth = d.date.startsWith(month);
            const cls = ['cal-cell', inMonth ? '' : 'other', d.date === today ? 'today' : ''].join(' ');
            const empty = d.workouts.length === 0;
            return (
              <button
                key={d.date}
                className={cls}
                aria-label={`${d.date}: ${empty ? (d.scheduled || d.overridden ? 'rest' : 'nothing') : d.names.join(' and ')}`}
                onClick={() => navigate(`/day/${d.date}?back=${encodeURIComponent(`/calendar?m=${month}`)}`)}
              >
                <span className="cal-num">
                  {Number(d.date.slice(8))}
                  {d.overridden && <span className="cal-dot" title="Changed by hand" />}
                </span>
                {!empty && <span className="cal-label">{d.names[0]}</span>}
                {d.names.length > 1 && <span className="cal-label">+{d.names.length - 1}</span>}
                {empty && (d.scheduled || d.overridden) && <span className="cal-label muted">Rest</span>}
              </button>
            );
          })}
        </div>
      )}
      <p className="small-print muted">A dot marks a day you changed by hand. Week starts on {data ? weekdayName(data.weekStart) : ''}; change it in Settings.</p>
    </div>
  );
}
