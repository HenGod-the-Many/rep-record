import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatMonth, monthGrid, shiftMonth, todayLocal, weekdayName } from '../db/dates';
import { getWeekStart, loadCalendar, resolveFrom } from '../db/schedule';
import { dayStatuses, type DayStatus } from '../db/dayStatus';
import { navigate } from '../router';
import { datesWithNotes } from '../db/journal';
import { IconButton, LargeTitle } from '../ui/components';
import { Icon } from '../ui/icons';
import { UndoBar } from './pickers';

/** First word of a workout name keeps calendar cells readable: "Chest, Back, Arms" -> "Chest". */
function shortName(name: string) {
  return name.split(/[ ,&]+/)[0] || name;
}

const SPOKEN: Record<DayStatus, string> = { done: 'done', planned: 'planned', missed: 'missed', rest: 'rest day', none: 'nothing planned' };

/** Month view (W-20, R-16.7): done, planned and missed days look different, and the legend says how. */
export function Calendar({ month }: { month: string }) {
  const today = todayLocal();
  const data = useLiveQuery(async () => {
    const [weekStart, cal, plans] = await Promise.all([getWeekStart(db), loadCalendar(db), db.plans.toArray()]);
    const names = new Map(plans.map((p) => [p.id, p.name]));
    const days = monthGrid(month, weekStart).map((d) => ({ ...resolveFrom(cal, d), names: [] as string[] }));
    for (const d of days) d.names = d.workouts.map((w) => shortName(names.get(w.planId) ?? '?'));
    const notes = await datesWithNotes(db, days.map((d) => d.date));
    const status = await dayStatuses(db, days.map((d) => d.date), today);
    return { weekStart, days, notes, status };
  }, [month, today]);

  const go = (m: string) => navigate(`/calendar?m=${m}`, { replace: true });

  return (
    <div className="screen">
      <LargeTitle context={month === today.slice(0, 7) ? 'This month' : undefined} title="Calendar" />
      <UndoBar />
      <div className="month-nav">
        <IconButton icon="chevron-left" label="Previous month" onClick={() => go(shiftMonth(month, -1))} />
        <h2>{formatMonth(month)}</h2>
        <IconButton icon="chevron-right" label="Next month" onClick={() => go(shiftMonth(month, 1))} />
      </div>
      {data && (
        <div className="cal-grid" role="grid">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="cal-head">{weekdayName((data.weekStart + i) % 7)}</div>
          ))}
          {data.days.map((d) => {
            const inMonth = d.date.startsWith(month);
            const st = data.status[d.date] ?? 'none';
            const cls = ['cal-cell', `is-${st}`, inMonth ? '' : 'other', d.date === today ? 'today' : ''].join(' ');
            const what = d.names.length ? `${d.names.join(' and ')}, ` : '';
            return (
              <button
                key={d.date}
                className={cls}
                aria-label={`${d.date}${d.date === today ? ' (today)' : ''}: ${what}${SPOKEN[st]}${d.overridden ? ', changed by hand' : ''}${data.notes.has(d.date) ? ', has a note' : ''}`}
                onClick={() => navigate(`/day/${d.date}?back=${encodeURIComponent(`/calendar?m=${month}`)}`)}
              >
                <span className="cal-num">
                  {Number(d.date.slice(8))}
                  {d.overridden && <span className="cal-dot" title="Changed by hand" />}
                  {data.notes.has(d.date) && <span className="cal-note" title="Has a note" />}
                </span>
                {st === 'done' && <Icon name="check" size={16} strong className="cal-check" />}
                {d.names.length > 0 && <span className="cal-label">{d.names[0]}</span>}
                {d.names.length > 1 && <span className="cal-label">+{d.names.length - 1}</span>}
                {st === 'missed' && <span className="cal-label cal-missed">missed</span>}
                {st === 'rest' && <span className="cal-label muted">Rest</span>}
              </button>
            );
          })}
        </div>
      )}
      <ul className="cal-legend" aria-label="What the days mean">
        <li><span className="cal-swatch is-done" /> Done</li>
        <li><span className="cal-swatch is-planned" /> Planned</li>
        <li><span className="cal-swatch is-missed" /> Missed</li>
        <li><span className="cal-swatch today" /> Today</li>
      </ul>
      <p className="ui-caption">A dot marks a day you changed by hand; a short bar, a day with a note. Week starts on {data ? weekdayName(data.weekStart) : ''}; change it in Settings.</p>
    </div>
  );
}
