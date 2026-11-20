import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { weekdayName } from '../db/dates';
import { getWeekStart, setWeekStart } from '../db/schedule';
import { getUnit, setUnit } from '../db/units';
import { Header } from './common';
import { BackupSection } from './Backup';

export function Settings() {
  const weekStart = useLiveQuery(() => getWeekStart(db), []);
  const unit = useLiveQuery(() => getUnit(db), []);
  return (
    <div className="screen">
      <Header title="Settings" back="/today" />
      <div className="field" role="group" aria-label="Weight unit">
        <span>Weight unit (weights are stored in pounds; switching changes only what you see)</span>
        <div className="segmented two">
          {(['lb', 'kg'] as const).map((u) => (
            <button key={u} className={unit === u ? 'active' : ''} aria-pressed={unit === u} onClick={() => setUnit(db, u)}>
              {u}
            </button>
          ))}
        </div>
      </div>
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
      <BackupSection />
    </div>
  );
}
