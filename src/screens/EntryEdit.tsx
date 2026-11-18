import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { removeAlternate, removeEntry, updateTargets } from '../db/plans';
import { navigate } from '../router';
import { attempt, ErrorText, Header } from './common';

export function EntryEdit({ planId, entryId }: { planId: string; entryId: string }) {
  const data = useLiveQuery(async () => {
    const entry = await db.planExercises.get(entryId);
    if (!entry) return { entry: null, exercises: new Map() };
    const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    return { entry, exercises };
  }, [entryId]);

  const [sets, setSets] = useState(3);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [note, setNote] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.entry && loadedFor !== data.entry.id) {
      setSets(data.entry.targetSets);
      setMin(String(data.entry.repMin));
      setMax(String(data.entry.repMax));
      setNote(data.entry.note);
      setLoadedFor(data.entry.id);
    }
  }, [data, loadedFor]);

  const back = `/plans/${planId}`;
  if (!data) return <div className="screen"><Header title="Exercise in plan" back={back} /></div>;
  if (!data.entry) {
    return (
      <div className="screen">
        <Header title="Exercise in plan" back={back} />
        <p className="muted">This entry no longer exists.</p>
      </div>
    );
  }
  const { entry, exercises } = data;
  const ex = exercises.get(entry.exerciseId);
  const unit = ex?.kind === 'timed' ? 'seconds' : 'reps';

  const save = async () => {
    const ok = await attempt(
      () => updateTargets(db, entryId, { targetSets: sets, repMin: Number(min), repMax: Number(max), note }),
      setError,
    );
    if (ok) navigate(back);
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${ex?.name ?? 'this exercise'} from the plan? Its history is kept.`)) return;
    await removeEntry(db, entryId);
    navigate(back);
  };

  return (
    <div className="screen">
      <Header title={ex?.name ?? 'Exercise in plan'} back={back} />

      <div className="field">
        <span>Target sets</span>
        <div className="stepper">
          <button aria-label="Fewer sets" onClick={() => setSets((s) => Math.max(1, s - 1))}>−</button>
          <output aria-live="polite">{sets}</output>
          <button aria-label="More sets" onClick={() => setSets((s) => Math.min(20, s + 1))}>+</button>
        </div>
      </div>
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

      <button className="btn-danger block spaced" onClick={remove}>Remove from plan</button>
    </div>
  );
}
