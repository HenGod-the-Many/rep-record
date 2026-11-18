import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { isClockTime, TIME_SLOTS } from '../db/dates';
import { listPlans } from '../db/plans';
import { dismissUndo, undoLast, usePendingUndo } from '../undo';

/** Native picker of the user's plans (one-date copies are not listed). */
export function PlanSelect(props: { value: string; onChange: (id: string) => void; label: string; placeholder?: string }) {
  const plans = useLiveQuery(() => listPlans(db), []) ?? [];
  return (
    <select className="select" value={props.value} onChange={(e) => props.onChange(e.target.value)} aria-label={props.label}>
      <option value="">{props.placeholder ?? 'Pick a plan…'}</option>
      {plans.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

/** Morning / Noon / Evening / Night, or a custom clock time. */
export function TimeSelect(props: { value: string; onChange: (time: string) => void; label: string }) {
  const custom = isClockTime(props.value);
  return (
    <span className="time-select">
      <select
        className="select"
        value={custom ? 'custom' : props.value}
        aria-label={props.label}
        onChange={(e) => props.onChange(e.target.value === 'custom' ? '07:00' : e.target.value)}
      >
        {TIME_SLOTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
        <option value="custom">Custom time…</option>
      </select>
      {custom && (
        <input
          type="time"
          value={props.value}
          aria-label={`${props.label}, clock time`}
          onChange={(e) => e.target.value && props.onChange(e.target.value)}
        />
      )}
    </span>
  );
}

/** "Moved Mon 16 Nov · Undo" after a calendar change. */
export function UndoBar() {
  const pending = usePendingUndo();
  if (!pending) return null;
  return (
    <div className="undo-bar" role="status">
      <span>{pending.label}</span>
      <button className="btn-secondary" onClick={() => undoLast()}>
        Undo
      </button>
      <button className="undo-close" aria-label="Dismiss" onClick={dismissUndo}>
        ✕
      </button>
    </div>
  );
}
