import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { addDays, daysBetween, formatDate, weekday, weekdayName } from '../db/dates';
import { applyMoveWithinWeek, moveAllFuture, previewMoveWithinWeek, type MovePreview } from '../db/reschedule';
import { ValidationError } from '../db/errors';
import { navigate } from '../router';
import { withUndo } from '../undo';
import { attempt, ErrorText, Header } from './common';

type Mode = 'week' | 'future';
type Cut = 'trailing' | 'pick';

export function MoveDay({ date, back }: { date: string; back: string }) {
  const [to, setTo] = useState(addDays(date, 1));
  const [mode, setMode] = useState<Mode>('week');
  const [cut, setCut] = useState<Cut>('trailing');
  const [picked, setPicked] = useState<number[]>([]);
  const [preview, setPreview] = useState<MovePreview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const drop = cut === 'trailing' ? ('trailing' as const) : picked;

  useEffect(() => {
    let live = true;
    if (mode !== 'week') {
      setPreview(null);
      setProblem(daysBetween(date, to) > 0 ? null : 'Pick a later date.');
      return;
    }
    previewMoveWithinWeek(db, date, to, { drop })
      .then((p) => live && (setPreview(p), setProblem(null)))
      .catch((e) => live && (setPreview(null), setProblem(e instanceof ValidationError ? e.message : String(e))));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, to, mode, cut, picked.join(',')]);

  // Raw overflow (before any drop choice) decides whether to ask what to cut.
  const [rawOverflow, setRawOverflow] = useState(0);
  useEffect(() => {
    if (mode !== 'week') return setRawOverflow(0);
    previewMoveWithinWeek(db, date, to).then((p) => setRawOverflow(p.overflow.length), () => setRawOverflow(0));
  }, [date, to, mode]);

  const confirm = async () => {
    const label = `Moved ${formatDate(date)} to ${formatDate(to)}`;
    const ok = await attempt(
      () => withUndo(label, () => (mode === 'week' ? applyMoveWithinWeek(db, date, to, { drop: rawOverflow ? drop : undefined }) : moveAllFuture(db, date, to))),
      setError,
    );
    if (ok) navigate(back);
  };

  const n = daysBetween(date, to);
  const lastDay = preview ? weekdayName(weekday(preview.week[6])) : '';
  const canConfirm = !problem && (mode === 'future' || (preview !== null && preview.overflow.length === 0));

  return (
    <div className="screen">
      <Header title={`Move ${formatDate(date)}`} back={back} />

      <label className="field">
        <span>New date</span>
        <input type="date" value={to} min={addDays(date, 1)} onChange={(e) => e.target.value && setTo(e.target.value)} />
      </label>

      <div className="field">
        <span>How far should it reach?</span>
        <div className="segmented two">
          <button className={mode === 'week' ? 'active' : ''} onClick={() => setMode('week')}>Within the week</button>
          <button className={mode === 'future' ? 'active' : ''} onClick={() => setMode('future')}>All future</button>
        </div>
      </div>

      {problem && <p className="error" role="alert">{problem}</p>}

      {mode === 'future' && !problem && (
        <p className="banner">
          Everything from {formatDate(date)} on moves {n} day{n === 1 ? '' : 's'} later, in the same order with the same rest days.
          The schedule ends {n} day{n === 1 ? '' : 's'} later too. {formatDate(date)}
          {n > 1 ? ` to ${formatDate(addDays(to, -1))}` : ''} become{n > 1 ? '' : 's'} rest.
        </p>
      )}

      {mode === 'week' && preview && (
        <>
          {preview.restAlert && (
            <p className="alert" role="alert">
              Rest days left this week go from {preview.restBefore} to {preview.restAfter}.
            </p>
          )}
          {rawOverflow > 0 && (
            <div className="field">
              <span>Not everything fits before {lastDay}. What should be cut?</span>
              <div className="segmented two">
                <button className={cut === 'trailing' ? 'active' : ''} onClick={() => setCut('trailing')}>Drop the last ones</button>
                <button className={cut === 'pick' ? 'active' : ''} onClick={() => setCut('pick')}>Choose which</button>
              </div>
              {cut === 'pick' && (
                <ul className="list">
                  {preview.sequence.map((u, k) => (
                    <li key={k}>
                      <label className="toggle check-row">
                        <input
                          type="checkbox"
                          checked={picked.includes(k)}
                          onChange={() => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}
                        />
                        Drop {u.label}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {preview.overflow.length > 0 && (
                <p className="error">Still doesn't fit: {preview.overflow.map((u) => u.label).join(', ')}. Drop one more.</p>
              )}
              {preview.dropped.length > 0 && <p className="small-print muted">Dropped this week: {preview.dropped.map((u) => u.label).join(', ')}.</p>}
            </div>
          )}
          <table className="week-table">
            <thead>
              <tr><th>Day</th><th>Now</th><th>After</th></tr>
            </thead>
            <tbody>
              {preview.week.map((d, i) => {
                const changed = preview.before[i].label !== preview.after[i].label;
                return (
                  <tr key={d} className={changed ? 'changed' : ''}>
                    <td>{formatDate(d)}</td>
                    <td className={preview.before[i].workouts.length ? '' : 'muted'}>{preview.before[i].label}</td>
                    <td className={preview.after[i].workouts.length ? '' : 'muted'}>{preview.after[i].label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <button className="btn-primary block" disabled={!canConfirm} onClick={confirm}>
        Move
      </button>
      <ErrorText message={error} />
    </div>
  );
}
