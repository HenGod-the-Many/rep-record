import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { removeAlternate, removeEntry, setActivityTarget, updateTargets } from '../db/plans';
import { distanceUnit, fromShownDistance, toShownDistance } from '../db/activities';
import { getUnit } from '../db/units';
import { navigate } from '../router';
import { attempt, ErrorText, Header } from './common';

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
  const saveActivity = async () => {
    const u = data.unit ?? 'lb';
    const ok = await attempt(
      () => setActivityTarget(db, entryId, Number(min), dist.trim() ? fromShownDistance(Number(dist.replace(',', '.')), u) : null),
      setError,
    );
    if (ok) navigate(back);
  };

  const save = async () => {
    const ok = await attempt(
      () => updateTargets(db, entryId, { targetSets: sets, repMin: Number(min), repMax: Number(max), note }),
      setError,
    );
    if (ok) navigate(back);
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${ex?.name ?? 'this exercise'} from the workout? Its history is kept.`)) return;
    await removeEntry(db, entryId);
    navigate(back);
  };

  return (
    <div className="screen">
      <Header title={ex?.name ?? 'Exercise in workout'} back={back} />

      {isActivity ? (
        <div className="stack">
          <div className="field-pair">
            <label className="field">
              <span>Target minutes</span>
              <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
            </label>
            {ex?.hasDistance && (
              <label className="field">
                <span>Target {distanceUnit(data.unit ?? 'lb')} (optional)</span>
                <input inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} />
              </label>
            )}
          </div>
          <ErrorText message={error} />
          <button className="btn-primary block" onClick={saveActivity}>Save target</button>
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
          <button aria-label="Fewer sets" onClick={() => setSets((s) => Math.max(1, s - 1))}>−</button>
          <output aria-live="polite">{sets}</output>
          <button aria-label="More sets" onClick={() => setSets((s) => Math.min(20, s + 1))}>+</button>
        </div>
      </div>
      )}
      <div className="field-pair">
        <label className="field">
          <span>Min {unit}</span>
          <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
        </label>
        <label className="field">
          <span>Max {unit}</span>
          <input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. per leg" />
      </label>
      <ErrorText message={error} />
      <button className="btn-primary block" onClick={save}>Save targets</button>
      </>
      )}

      <h2 className="group-title">Exercise</h2>
      <button
        className="btn-secondary block"
        onClick={() => navigate(`/pick?mode=replace&plan=${planId}&entry=${entryId}`)}
      >
        Replace {ex?.name ?? 'exercise'} permanently
      </button>

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

      <button className="btn-danger block spaced" onClick={remove}>Remove from workout</button>
    </div>
  );
}
