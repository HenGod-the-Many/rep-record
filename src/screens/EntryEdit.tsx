import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { removeAlternate, removeEntry, setActivityTarget, updateTargets } from '../db/plans';
import { distanceUnit, fromShownDistance, toShownDistance } from '../db/activities';
import { getUnit } from '../db/units';
import { navigate } from '../router';
import { attempt, ErrorText, Header } from './common';
import { MoreMenu } from '../ui/components';

export function EntryEdit({ planId, entryId }: { planId: string; entryId: string }) {
  const data = useLiveQuery(async () => {
    const entry = await db.planExercises.get(entryId);
    if (!entry) return { entry: null, exercises: new Map() };
    const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    return { entry, exercises, unit: await getUnit(db) };
  }, [entryId]);

  const [sets, setSets] = useState(3);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [note, setNote] = useState('');
  const [dist, setDist] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Shown after each save: edit screens save as you change (W-20 answer 2), no Save button. */
  const [saved, setSaved] = useState(false);
  // A change is saved shortly after it is typed, and any change still waiting is saved when the
  // screen closes, so tapping Back with the cursor still in a box never loses it.
  const pending = useRef<(() => unknown) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const run = pending.current;
    pending.current = null;
    run?.();
  };
  const later = (run: () => unknown) => {
    setSaved(false);
    pending.current = run;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  };
  useEffect(() => () => flush(), []);

  useEffect(() => {
    if (data?.entry && loadedFor !== data.entry.id) {
      setSets(data.entry.targetSets);
      setMin(String(data.entry.repMin));
      setMax(String(data.entry.repMax));
      setNote(data.entry.note);
      const d = data.entry.targetDistanceMi;
      setDist(d ? String(Math.round(toShownDistance(d, data.unit ?? 'lb') * 10) / 10) : '');
      setLoadedFor(data.entry.id);
    }
  }, [data, loadedFor]);

  const back = `/plans/${planId}`;
  if (!data) return <div className="screen"><Header title="Exercise in workout" back={back} /></div>;
  if (!data.entry) {
    return (
      <div className="screen">
        <Header title="Exercise in workout" back={back} />
        <p className="muted">This entry no longer exists.</p>
      </div>
    );
  }
  const { entry, exercises } = data;
  const ex = exercises.get(entry.exerciseId);
  const unit = ex?.kind === 'timed' ? 'seconds' : 'reps';

  const isActivity = ex?.kind === 'activity';
  const saveActivity = async (v: { min?: string; dist?: string } = {}) => {
    const u = data.unit ?? 'lb';
    const m = v.min ?? min;
    const d = v.dist ?? dist;
    const ok = await attempt(
      () => setActivityTarget(db, entryId, Number(m), d.trim() ? fromShownDistance(Number(d.replace(',', '.')), u) : null),
      setError,
    );
    setSaved(ok);
  };

  // Values passed in come straight from the box being left, so a save never uses a stale value.
  const save = async (v: { targetSets?: number; repMin?: string; repMax?: string; note?: string } = {}) => {
    const ok = await attempt(
      () => updateTargets(db, entryId, { targetSets: v.targetSets ?? sets, repMin: Number(v.repMin ?? min), repMax: Number(v.repMax ?? max), note: v.note ?? note }),
      setError,
    );
    setSaved(ok);
  };
  const stepSets = (by: number) => {
    const n = Math.min(20, Math.max(1, sets + by));
    setSets(n);
    void save({ targetSets: n });
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${ex?.name ?? 'this exercise'} from the workout? Its history is kept.`)) return;
    await removeEntry(db, entryId);
    navigate(back);
  };

  return (
    <div className="screen">
      <Header
        title={ex?.name ?? 'Exercise in workout'}
        back={back}
        action={<MoreMenu label={`More for ${ex?.name ?? 'this exercise'}`} items={[
          { label: `Replace ${ex?.name ?? 'exercise'} permanently…`, onSelect: () => navigate(`/pick?mode=replace&plan=${planId}&entry=${entryId}`) },
          { label: 'Remove from workout', danger: true, onSelect: remove },
        ]} />}
      />

      {isActivity ? (
        <div className="stack">
          <div className="field-pair">
            <label className="field">
              <span>Target minutes</span>
              <input inputMode="numeric" value={min} onChange={(e) => { const v = e.target.value; setMin(v); later(() => saveActivity({ min: v })); }} onBlur={flush} />
            </label>
            {ex?.hasDistance && (
              <label className="field">
                <span>Target {distanceUnit(data.unit ?? 'lb')} (optional)</span>
                <input inputMode="decimal" value={dist} onChange={(e) => { const v = e.target.value; setDist(v); later(() => saveActivity({ dist: v })); }} onBlur={flush} />
              </label>
            )}
          </div>
          <ErrorText message={error} />
          <p className="ui-caption" aria-live="polite">{saved ? 'Saved.' : 'Changes save when you leave a box.'}</p>
        </div>
      ) : (
      <>
      {data?.entry.groupKey ? (
        <p className="small-print muted">
          Sets follow the {data.entry.groupKind === 'circuit' ? 'circuit' : 'superset'}'s rounds ({data.entry.groupRounds}). Change rounds from the workout's Edit.
        </p>
      ) : (
      <div className="field">
        <span>Target sets</span>
        <div className="stepper">
          <button aria-label="Fewer sets" onClick={() => stepSets(-1)}>−</button>
          <output aria-live="polite">{sets}</output>
          <button aria-label="More sets" onClick={() => stepSets(1)}>+</button>
        </div>
      </div>
      )}
      <div className="field-pair">
        <label className="field">
          <span>Min {unit}</span>
          <input inputMode="numeric" value={min} onChange={(e) => { const v = e.target.value; setMin(v); later(() => save({ repMin: v })); }} onBlur={flush} />
        </label>
        <label className="field">
          <span>Max {unit}</span>
          <input inputMode="numeric" value={max} onChange={(e) => { const v = e.target.value; setMax(v); later(() => save({ repMax: v })); }} onBlur={flush} />
        </label>
      </div>
      <label className="field">
        <span>Note (optional)</span>
        <input value={note} onChange={(e) => { const v = e.target.value; setNote(v); later(() => save({ note: v })); }} onBlur={flush} placeholder="e.g. per leg" />
      </label>
      <ErrorText message={error} />
      <p className="ui-caption" aria-live="polite">{saved ? 'Saved.' : 'Changes save as you make them.'}</p>
      </>
      )}

      <h2 className="group-title">Alternates</h2>
      <p className="muted small-print">Offered as a quick swap during a workout.</p>
      <ul className="list">
        {entry.alternateIds.map((id) => (
          <li key={id} className="alt-row">
            <span>{exercises.get(id)?.name ?? 'Unknown'}</span>
            <button
              className="btn-secondary"
              aria-label={`Remove alternate ${exercises.get(id)?.name}`}
              onClick={() => removeAlternate(db, entryId, id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button className="btn-secondary block" onClick={() => navigate(`/pick?mode=alt&plan=${planId}&entry=${entryId}`)}>
        + Add alternate
      </button>

    </div>
  );
}
