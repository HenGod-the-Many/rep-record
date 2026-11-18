import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { weekdayName } from '../db/dates';
import { getWeekStart, setWeekStart } from '../db/schedule';
import { Header } from './common';

export function Settings() {
  const weekStart = useLiveQuery(() => getWeekStart(db), []);
  return (
    <div className="screen">
      <Header title="Settings" back="/today" />
      <label className="field">
        <span>Week starts on (used by "Move within the week" and the calendar)</span>
        <select className="select" value={weekStart ?? 1} onChange={(e) => setWeekStart(db, Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <option key={d} value={d}>
              {weekdayName(d)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
