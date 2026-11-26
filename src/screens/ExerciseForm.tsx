import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ExerciseKind } from '../db/db';
import { createExercise, muscleGroups, setArchived, updateExercise } from '../db/exercises';
import { navigate } from '../router';
import { attempt, ErrorText, Header } from './common';
import { KIND_LABEL } from '../format';

const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'EZ bar', 'Kettlebell', 'Band'];

export function ExerciseForm({ id, back = '/exercises' }: { id: string | null; back?: string }) {
  // null = looked up and not found; undefined = still loading.
  const existing = useLiveQuery(async () => (id ? ((await db.exercises.get(id)) ?? null) : null), [id]);
  const groups = useLiveQuery(() => muscleGroups(db), []) ?? [];
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [kind, setKind] = useState<ExerciseKind>('weight');
  const [hasDistance, setHasDistance] = useState(true);
  const [met, setMet] = useState('5');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(id === null);

  useEffect(() => {
    if (existing && !loaded) {
      setName(existing.name);
      setMuscleGroup(existing.muscleGroup);
      setEquipment(existing.equipment);
      setKind(existing.kind);
      setHasDistance(existing.hasDistance ?? true);
      setMet(String(existing.met ?? 5));
      setLoaded(true);
    }
  }, [existing, loaded]);

  if (id && existing === undefined) return <div className="screen"><Header title="Exercise" back={back} /></div>;
  if (id && existing === null) {
    return (
      <div className="screen">
        <Header title="Exercise" back={back} />
        <p className="muted">This exercise no longer exists.</p>
      </div>
    );
  }

  const save = async () => {
    const input = { name, muscleGroup, equipment, kind, ...(kind === 'activity' ? { hasDistance, met: Number(met.replace(',', '.')) } : {}) };
    const ok = await attempt(() => (id ? updateExercise(db, id, input) : createExercise(db, input)), setError);
    if (ok) navigate(back);
  };

  const toggleArchive = async () => {
    if (!id || !existing) return;
    await setArchived(db, id, !existing.archived);
    navigate(back);
  };

  return (
    <div className="screen">
      <Header
        title={id ? 'Edit exercise' : 'New exercise'}
        back={back}
        action={id ? <button className="link" onClick={() => navigate(`/exercises/${id}/history`)}>History</button> : undefined}
      />
      {existing?.archived && <p className="banner">This exercise is archived. It is hidden from lists and pickers.</p>}
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bench press" />
      </label>
      <label className="field">
        <span>Muscle group</span>
        <input list="muscle-groups" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} />
        <datalist id="muscle-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </label>
      <label className="field">
        <span>Equipment</span>
        <input list="equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)} />
        <datalist id="equipment">
          {EQUIPMENT.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </label>
      <fieldset className="field">
        <legend>Measured as</legend>
        <div className="segmented">
          {(Object.keys(KIND_LABEL) as ExerciseKind[]).map((k) => (
            <button key={k} type="button" className={kind === k ? 'active' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </fieldset>
      {kind === 'activity' && (
        <div className="stack">
          <label className="switch-label">
            <input type="checkbox" checked={hasDistance} onChange={(e) => setHasDistance(e.target.checked)} />
            <span>Has distance (miles or km)</span>
          </label>
          <label className="field">
            <span>MET value (for the calorie estimate)</span>
            <input inputMode="decimal" value={met} onChange={(e) => setMet(e.target.value)} />
            <span className="small-print muted">About 3.5 for walking, 7.5 for cycling, 9.8 for running.</span>
          </label>
        </div>
      )}
      <ErrorText message={error} />
      <button className="btn-primary block" onClick={save}>
        Save
      </button>
      {id && existing && (
        <button className="btn-secondary block" onClick={toggleArchive}>
          {existing.archived ? 'Restore exercise' : 'Archive exercise'}
        </button>
      )}
      {id && existing && !existing.archived && (
        <p className="muted small-print">Archiving hides it but keeps its history. Exercises are never deleted.</p>
      )}
    </div>
  );
}
