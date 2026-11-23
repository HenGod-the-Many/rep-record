import { useState } from 'react';
import { backupOverdue } from '../db/backup';
import { getUnit } from '../db/units';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatDate, timeLabel } from '../db/dates';
import { getEntries } from '../db/plans';
import { createDateWorkout, makeDateCopy } from '../db/reschedule';
import { findSession, reopenSession, startOrResume } from '../db/logging';
import {
  addWorkoutToDate,
  clearDate,
  removeWorkoutFromDate,
  replaceWorkout,
  resetDate,
  resolveDate,
  setWorkoutTime,
} from '../db/schedule';
import { DEFAULT_TIME } from '../db/seed';
import { formatTargets } from '../format';
import { navigate } from '../router';
import { DayNoteSection } from './Journal';
import { withUndo } from '../undo';
import { attempt, ErrorText, Header } from './common';
import { PlanSelect, TimeSelect, UndoBar } from './pickers';

/** One date's workouts, with quick changes. Used for Today and for any calendar date. */
/** One line on Today when the last backup is more than 7 days old (W-07). */
function BackupReminder() {
  const overdue = useLiveQuery(() => backupOverdue(db), []);
  if (!overdue) return null;
  return (
    <p className="banner backup-reminder">
      No backup in the last 7 days.{' '}
      <button className="link" onClick={() => navigate('/settings')}>
        Back up now
      </button>
    </p>
  );
}

export function DayView({ date, isToday, back }: { date: string; isToday?: boolean; back?: string }) {
  const data = useLiveQuery(async () => {
    const day = await resolveDate(db, date);
    const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    const workouts = await Promise.all(
      day.workouts.map(async (w) => {
        const plannedTimes = day.workouts.filter((x) => x.planId === w.planId).map((x) => x.time);
        const session = await findSession(db, { date, planId: w.planId, time: w.time, plannedTimes });
        return {
          ...w,
          plannedTimes,
          session,
          setCount: session ? await db.setLogs.where('sessionId').equals(session.id).count() : 0,
          plan: await db.plans.get(w.planId),
          entries: await getEntries(db, w.planId),
        };
      }),
    );
    return { day, workouts, exercises, unit: await getUnit(db) };
  }, [date]);
  const [replacing, setReplacing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newPlan, setNewPlan] = useState('');
  const [newTime, setNewTime] = useState(DEFAULT_TIME);
  const [error, setError] = useState<string | null>(null);

  const title = isToday ? 'Today' : formatDate(date);
  const here = isToday ? '/today' : `/day/${date}`;
  const action = isToday ? (
    <button className="header-link" onClick={() => navigate('/settings')}>
      Settings
    </button>
  ) : undefined;

  if (!data) return <div className="screen"><Header title={title} back={back} action={action} /></div>;
  const { day, workouts, exercises } = data;
  const short = formatDate(date);

  const change = (label: string, fn: () => Promise<unknown>) => attempt(() => withUndo(label, fn), setError);

  const add = async () => {
    if (!newPlan) return setError('Pick a plan to add.');
    if (await change(`Added a workout to ${short}`, () => addWorkoutToDate(db, date, newPlan, newTime))) {
      setAdding(false);
      setNewPlan('');
    }
  };

  const buildNew = async () => {
    let id = '';
    if (await change(`Added a new workout to ${short}`, async () => { id = await createDateWorkout(db, date, newTime); })) {
      setAdding(false);
      navigate(`/plans/${id}?back=${encodeURIComponent(here)}`);
    }
  };

  const editForDate = async (index: number) => {
    let copyId = '';
    if (await change(`Made ${short}'s workout editable`, async () => { copyId = await makeDateCopy(db, date, index); })) {
      navigate(`/plans/${copyId}?back=${encodeURIComponent(here)}`);
    }
  };

  return (
    <div className="screen">
      <Header title={title} back={back} action={action} />
      {isToday && <p className="subtitle">{short}</p>}
      {isToday && <BackupReminder />}
      <UndoBar />

      {!day.scheduled && !day.overridden && <p className="banner">Nothing scheduled. Put a split on the calendar from Splits, or add a workout here.</p>}
      {(day.scheduled || day.overridden) && workouts.length === 0 && <p className="banner">Rest day.</p>}
      {day.overridden && (
        <p className="small-print muted">
          Changed by hand.{' '}
          <button className="link" onClick={() => change(`Reset ${short} to the split`, () => resetDate(db, date))}>
            Reset to the split
          </button>
        </p>
      )}

      {workouts.map((w, i) => (
        <section className="card" key={`${w.planId}-${i}`}>
          <div className="card-head">
            <div>
              <div className="card-title">
                {w.plan?.name ?? 'Deleted plan'}
                {w.plan?.hidden && <span className="tag">{w.plan.sourcePlanId ? "edited for this date" : "this date only"}</span>}
              </div>
              <div className="row-sub">{timeLabel(w.time)}</div>
            </div>
            <TimeSelect
              label={`Time for ${w.plan?.name ?? 'workout'}`}
              value={w.time}
              onChange={(t) => change(`Changed the time on ${short}`, () => setWorkoutTime(db, date, i, t))}
            />
          </div>
          <ul className="mini-list">
            {w.entries.map((e) => {
              const ex = exercises.get(e.exerciseId);
              return (
                <li key={e.id}>
                  <span>{ex?.name ?? 'Unknown exercise'}</span>
                  <span className="muted">{ex ? formatTargets(e, ex.kind, data.unit) : ''}</span>
                </li>
              );
            })}
            {w.entries.length === 0 && <li className="muted">No exercises in this plan yet.</li>}
          </ul>
          {w.session && w.session.finishedAt !== null ? (
            <div className="done-line">
              <span className="done-mark">✓ Done · {w.setCount} {w.setCount === 1 ? 'set' : 'sets'}</span>
              {w.session.journalNote.trim() && <p className="workout-note small-print">{w.session.journalNote}</p>}
              <button className="btn-secondary" onClick={() => navigate(`/log/${w.session!.id}`)}>View</button>
              {isToday && (
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    if (await attempt(() => reopenSession(db, w.session!.id), setError)) navigate(`/log/${w.session!.id}`);
                  }}
                >
                  Reopen
                </button>
              )}
            </div>
          ) : w.session ? (
            <button className={`${isToday ? 'btn-primary' : 'btn-secondary'} block`} onClick={() => navigate(`/log/${w.session!.id}`)}>
              {isToday ? 'Resume workout' : 'View workout'} · {w.setCount} {w.setCount === 1 ? 'set' : 'sets'} logged
            </button>
          ) : isToday ? (
            <button
              className="btn-primary block"
              disabled={!w.plan}
              onClick={async () => {
                let id = '';
                const ok = await attempt(async () => {
                  id = await startOrResume(db, { date, planId: w.planId, time: w.time, plannedTimes: w.plannedTimes });
                }, setError);
                if (ok) navigate(`/log/${id}`);
              }}
            >
              Start workout
            </button>
          ) : (
            <p className="small-print muted">Workouts are logged on the day, from Today.</p>
          )}
          {replacing === i ? (
            <div className="inline-form">
              <PlanSelect
                label="Replace with"
                value=""
                placeholder="Replace with…"
                onChange={async (id) => {
                  if (id && (await change(`Replaced a workout on ${short}`, () => replaceWorkout(db, date, i, id)))) setReplacing(null);
                }}
              />
              <button className="btn-secondary" onClick={() => setReplacing(null)}>Cancel</button>
            </div>
          ) : (
            <div className="button-row">
              <button className="btn-secondary" onClick={() => editForDate(i)}>Edit for this date</button>
              <button className="btn-secondary" onClick={() => setReplacing(i)}>Replace</button>
              <button className="btn-danger" onClick={() => change(`Removed a workout from ${short}`, () => removeWorkoutFromDate(db, date, i))}>
                Remove
              </button>
            </div>
          )}
        </section>
      ))}

      {adding ? (
        <div className="card">
          <div className="card-title">Add a workout to {short}</div>
          <div className="stack">
            <TimeSelect label="Time" value={newTime} onChange={setNewTime} />
            <button className="btn-primary" onClick={buildNew}>Build a new workout</button>
            <p className="small-print muted">Starts empty; you add the exercises. Or use one of your plans:</p>
            <PlanSelect label="Plan to add" value={newPlan} onChange={setNewPlan} />
            <div className="button-row two">
              <button className="btn-secondary" onClick={add} disabled={!newPlan}>Add plan</button>
              <button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="button-row">
          <button className="btn-secondary" onClick={() => setAdding(true)}>+ Add workout</button>
          <button className="btn-secondary" disabled={workouts.length === 0} onClick={() => navigate(`/move/${date}?back=${encodeURIComponent(here)}`)}>
            Move day
          </button>
          <button className="btn-danger" disabled={workouts.length === 0} onClick={() => change(`Cleared ${short}`, () => clearDate(db, date))}>
            Clear day
          </button>
        </div>
      )}
      <ErrorText message={error} />
      <DayNoteSection date={date} />
    </div>
  );
}
