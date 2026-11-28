import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { addDays, formatDate, timeLabel, todayLocal } from '../db/dates';
import {
  createSplit,
  deleteSchedule,
  deleteSplit,
  duplicateSplit,
  getSplitDays,
  listSchedules,
  listSplits,
  renameSplit,
  scheduleSplit,
  setCycleLength,
  setSplitDayWorkouts,
} from '../db/schedule';
import { DEFAULT_TIME } from '../db/seed';
import { navigate } from '../router';
import { withUndo } from '../undo';
import { attempt, ErrorText, Header, RenameField } from './common';
import { MoreMenu } from '../ui/components';
import { Icon } from '../ui/icons';
import { LibraryTop } from './Library';
import { PlanSelect, TimeSelect, UndoBar } from './pickers';

type Unit = 'days' | 'weeks';
const toDays = (n: number, unit: Unit) => (unit === 'weeks' ? n * 7 : n);

function LengthInput(props: { value: string; unit: Unit; onValue: (v: string) => void; onUnit: (u: Unit) => void; label: string }) {
  return (
    <div className="length-input">
      <input type="number" inputMode="numeric" min={1} value={props.value} aria-label={props.label} onChange={(e) => props.onValue(e.target.value)} />
      <select className="select" value={props.unit} aria-label={`${props.label} unit`} onChange={(e) => props.onUnit(e.target.value as Unit)}>
        <option value="days">days</option>
        <option value="weeks">weeks</option>
      </select>
    </div>
  );
}

export function SplitList() {
  const data = useLiveQuery(async () => {
    const [splits, schedules] = await Promise.all([listSplits(db), db.schedules.toArray()]);
    return splits.map((s) => ({ ...s, scheduled: schedules.filter((x) => x.splitId === s.id).length }));
  }, []);
  const [name, setName] = useState('');
  const [len, setLen] = useState('1');
  const [unit, setUnit] = useState<Unit>('weeks');
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    let id = '';
    if (await attempt(async () => { id = await createSplit(db, name, toDays(Number(len), unit)); }, setError)) navigate(`/splits/${id}`);
  };

  return (
    <div className="screen">
      <LibraryTop part="programs" />
      <UndoBar />
      <ul className="list">
        {(data ?? []).map((s) => (
          <li key={s.id}>
            <button className="row" onClick={() => navigate(`/splits/${s.id}`)}>
              <span className="row-main">{s.name}</span>
              <span className="row-sub">
                {s.cycleDays % 7 === 0 ? `${s.cycleDays / 7}-week` : `${s.cycleDays}-day`} cycle
                {s.scheduled > 0 ? ` · on the calendar` : ' · not scheduled'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="card">
        <div className="card-title">New program</div>
        <div className="stack">
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New program name" />
          <LengthInput label="Cycle length" value={len} unit={unit} onValue={setLen} onUnit={setUnit} />
          <button className="btn-primary" onClick={create}>Create</button>
        </div>
      </div>
      <ErrorText message={error} />
    </div>
  );
}

export function SplitEdit({ splitId }: { splitId: string }) {
  const data = useLiveQuery(async () => {
    const split = await db.splits.get(splitId);
    if (!split) return { split: null, days: [], schedules: [], names: new Map<string, string>() };
    const [days, schedules, plans] = await Promise.all([getSplitDays(db, splitId), listSchedules(db, splitId), db.plans.toArray()]);
    return { split, days, schedules, names: new Map(plans.map((p) => [p.id, p.name])) };
  }, [splitId]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [cycle, setCycle] = useState<string | null>(null);
  const [cycleUnit, setCycleUnit] = useState<Unit>('days');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newPlan, setNewPlan] = useState('');
  const [newTime, setNewTime] = useState(DEFAULT_TIME);
  const [start, setStart] = useState(todayLocal());
  const [schedLen, setSchedLen] = useState('4');
  const [schedUnit, setSchedUnit] = useState<Unit>('weeks');
  const [error, setError] = useState<string | null>(null);

  if (!data) return <div className="screen"><Header title="Program" back="/splits" /></div>;
  if (!data.split) {
    return (
      <div className="screen">
        <Header title="Program" back="/splits" />
        <p className="muted">This program no longer exists.</p>
      </div>
    );
  }
  const { split, days, schedules, names } = data;

  const saveCycle = async () => {
    if (cycle === null) return;
    const n = toDays(Number(cycle), cycleUnit);
    if (n < split.cycleDays && !window.confirm(`Shorten the cycle to ${n} days? Days ${n + 1} to ${split.cycleDays} will be removed.`)) return;
    if (await attempt(() => setCycleLength(db, splitId, n), setError)) setCycle(null);
  };
  const addWorkout = async (dayId: string, current: { planId: string; time: string }[]) => {
    if (!newPlan) return setError('Pick a workout to add.');
    if (await attempt(() => setSplitDayWorkouts(db, dayId, [...current, { planId: newPlan, time: newTime }]), setError)) {
      setAddingTo(null);
      setNewPlan('');
    }
  };
  const schedule = async () => {
    if (await attempt(() => withUndo(`Scheduled ${split.name}`, () => scheduleSplit(db, splitId, start, toDays(Number(schedLen), schedUnit))), setError)) {
      navigate(`/calendar?m=${start.slice(0, 7)}`);
    }
  };
  const remove = async () => {
    const ranges = schedules.map((s) => `${formatDate(s.startDate)} – ${formatDate(addDays(s.startDate, s.lengthDays - 1))}`);
    const warning = ranges.length
      ? `Delete the program "${split.name}"?

It is on your calendar (${ranges.join('; ')}). Those planned days will be removed too. You can undo right after.`
      : `Delete the program "${split.name}"?`;
    if (!window.confirm(warning)) return;
    if (await attempt(() => withUndo(`Deleted ${split.name}`, () => deleteSplit(db, splitId)), setError)) navigate('/splits');
  };

  return (
    <div className="screen">
      <Header
        title={split.name}
        back="/splits"
        action={
          <MoreMenu
            label={`More for ${split.name}`}
            items={[
              { label: 'Rename', onSelect: () => setRenaming(split.name) },
              { label: 'Duplicate', onSelect: async () => navigate(`/splits/${await duplicateSplit(db, splitId)}`) },
              { label: 'Delete program', danger: true, onSelect: remove },
            ]}
          />
        }
      />
      {renaming === null ? null : (
        <RenameField label="Program name" initial={renaming} onSave={(n) => renameSplit(db, splitId, n)} onClose={() => setRenaming(null)} onError={setError} />
      )}
      <ErrorText message={error} />

      <h2 className="group-title">Cycle: {split.cycleDays} days</h2>
      {cycle === null ? (
        <button className="btn-secondary block" onClick={() => { setCycle(String(split.cycleDays)); setCycleUnit('days'); }}>Change cycle length</button>
      ) : (
        <div className="stack">
          <LengthInput label="Cycle length" value={cycle} unit={cycleUnit} onValue={setCycle} onUnit={setCycleUnit} />
          <div className="button-row two">
            <button className="btn-primary" onClick={saveCycle}>Save</button>
            <button className="btn-secondary" onClick={() => setCycle(null)}>Cancel</button>
          </div>
        </div>
      )}

      <ul className="list">
        {days.map((d) => (
          <li key={d.id} className="card">
            <div className="card-title">Day {d.dayIndex + 1}</div>
            {d.workouts.length === 0 && <p className="muted small-print">Rest</p>}
            {d.workouts.map((w, i) => (
              <div className="workout-line" key={i}>
                <span>
                  <strong>{names.get(w.planId) ?? 'Deleted workout'}</strong> <span className="muted">· {timeLabel(w.time)}</span>
                </span>
                <span className="workout-actions">
                  <TimeSelect
                    label={`Time for ${names.get(w.planId)}`}
                    value={w.time}
                    onChange={(t) => attempt(() => setSplitDayWorkouts(db, d.id, d.workouts.map((x, j) => (j === i ? { ...x, time: t } : x))), setError)}
                  />
                  <button
                    className="icon-btn"
                    aria-label={`Remove ${names.get(w.planId)} from day ${d.dayIndex + 1}`}
                    onClick={() => attempt(() => setSplitDayWorkouts(db, d.id, d.workouts.filter((_, j) => j !== i)), setError)}
                  >
                    <Icon name="close" size={20} />
                  </button>
                </span>
              </div>
            ))}
            {addingTo === d.id ? (
              <div className="stack">
                <PlanSelect label={`Workout for day ${d.dayIndex + 1}`} value={newPlan} onChange={setNewPlan} />
                <TimeSelect label="Time" value={newTime} onChange={setNewTime} />
                <div className="button-row two">
                  <button className="btn-primary" onClick={() => addWorkout(d.id, d.workouts)}>Add</button>
                  <button className="btn-secondary" onClick={() => setAddingTo(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="btn-secondary block" onClick={() => { setAddingTo(d.id); setNewPlan(''); }}>+ Add workout</button>
            )}
          </li>
        ))}
      </ul>

      <h2 className="group-title">On the calendar</h2>
      {schedules.length === 0 && <p className="muted small-print">Not scheduled yet.</p>}
      <ul className="list">
        {schedules.map((s) => (
          <li key={s.id} className="alt-row">
            <span>
              {formatDate(s.startDate)} – {formatDate(addDays(s.startDate, s.lengthDays - 1))}
            </span>
            <MoreMenu
              label={`More for ${formatDate(s.startDate)}`}
              items={[{ label: 'Remove from the calendar', danger: true, onSelect: () => attempt(() => withUndo('Removed a schedule', () => deleteSchedule(db, s.id)), setError) }]}
            />
          </li>
        ))}
      </ul>
      <div className="card">
        <div className="card-title">Schedule this program</div>
        <div className="stack">
          <label className="field">
            <span>Start date (day 1 of the cycle)</span>
            <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
          </label>
          <LengthInput label="For" value={schedLen} unit={schedUnit} onValue={setSchedLen} onUnit={setSchedUnit} />
          <button className="btn-primary" onClick={schedule}>Schedule</button>
        </div>
      </div>
    </div>
  );
}
