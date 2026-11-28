import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ExerciseKind } from '../db/db';
import { createExercise, loggedSetCount, muscleGroups, setArchived, updateExercise, type ExerciseInput } from '../db/exercises';
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
  /** Editing saves as you change (W-25, R-17.6); "Saved." shows after each save. */
  const [saved, setSaved] = useState(false);
  /** A refused name shows its error right under the name box. */
  const [nameError, setNameError] = useState<string | null>(null);
  const input = (): ExerciseInput => ({ name, muscleGroup, equipment, kind, ...(kind === 'activity' ? { hasDistance, met: Number(met.replace(',', '.')) } : {}) });
  // The latest values, so a change still in a box is saved when the screen closes (tapping Back mid-typing).
  const latest = useRef<{ input: ExerciseInput; dirty: boolean } | null>(null);

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
  // A change still waiting in a box is saved when the screen closes. A refused one (name in use) is dropped.
  useEffect(
    () => () => {
      const l = latest.current;
      if (id && l?.dirty) updateExercise(db, id, l.input).catch(() => undefined);
    },
    [id],
  );

  const sameAs = (x: ExerciseInput) =>
    !!existing &&
    x.name.trim() === existing.name &&
    x.muscleGroup.trim() === existing.muscleGroup &&
    x.equipment.trim() === existing.equipment &&
    x.kind === existing.kind &&
    (x.kind !== 'activity' || ((x.hasDistance ?? true) === (existing.hasDistance ?? true) && x.met === (existing.met ?? 5)));
  if (id && loaded) latest.current = { input: input(), dirty: !sameAs(input()) };

  if (id && existing === undefined) return <div className="screen"><Header title="Exercise" back={back} /></div>;
  if (id && existing === null) {
    return (
      <div className="screen">
        <Header title="Exercise" back={back} />
        <p className="muted">This exercise no longer exists.</p>
      </div>
    );
  }

  // New exercise: it is created by its button, which says when it exists.
  const create = async () => {
    if (await attempt(() => createExercise(db, input()), setError)) navigate(back);
  };

  // Existing exercise: each change is saved when its box is left, or at once for a choice.
  const commit = async (next: ExerciseInput = input()) => {
    if (!id || !existing || sameAs(next)) return;
    const nameChanged = next.name.trim() !== existing.name;
    const ok = await attempt(() => updateExercise(db, id, next), nameChanged ? setNameError : setError);
    if (ok) {
      setError(null);
      setNameError(null);
    }
    setSaved(ok);
    if (!ok) {
      // A refused change (a name already in use) keeps the old value; the error says why.
      setName(existing.name);
      setMuscleGroup(existing.muscleGroup);
      setEquipment(existing.equipment);
      setMet(String(existing.met ?? 5));
      setKind(existing.kind);
      setHasDistance(existing.hasDistance ?? true);
    }
  };
  const changeKind = async (k: ExerciseKind) => {
    if (k === kind) return;
    if (id && existing) {
      const n = await loggedSetCount(db, id);
      const what = `${n} logged ${n === 1 ? 'set' : 'sets'}`;
      if (n > 0 && !window.confirm(`This exercise has ${what}. Changing how it is measured changes how they read. Change it?`)) return;
      setKind(k);
      await commit({ ...input(), kind: k, ...(k === 'activity' ? { hasDistance, met: Number(met.replace(',', '.')) } : {}) });
    } else setKind(k);
  };
  const changeDistance = async (v: boolean) => {
    setHasDistance(v);
    if (id) await commit({ ...input(), hasDistance: v });
  };
  const onBlur = id ? () => void commit() : undefined;

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
        <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} onBlur={onBlur} placeholder="e.g. Bench press" />
      </label>
      <ErrorText message={nameError} />
      <label className="field">
        <span>Muscle group</span>
        <input list="muscle-groups" value={muscleGroup} onChange={(e) => { setMuscleGroup(e.target.value); setSaved(false); }} onBlur={onBlur} />
        <datalist id="muscle-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </label>
      <label className="field">
        <span>Equipment</span>
        <input list="equipment" value={equipment} onChange={(e) => { setEquipment(e.target.value); setSaved(false); }} onBlur={onBlur} />
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
            <button key={k} type="button" className={kind === k ? 'active' : ''} aria-pressed={kind === k} onClick={() => void changeKind(k)}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </fieldset>
      {kind === 'activity' && (
        <div className="stack">
          <label className="switch-label">
            <input type="checkbox" checked={hasDistance} onChange={(e) => void changeDistance(e.target.checked)} />
            <span>Has distance (miles or km)</span>
          </label>
          <label className="field">
            <span>MET value (for the calorie estimate)</span>
            <input inputMode="decimal" value={met} onChange={(e) => { setMet(e.target.value); setSaved(false); }} onBlur={onBlur} />
            <span className="small-print muted">About 3.5 for walking, 7.5 for cycling, 9.8 for running.</span>
          </label>
        </div>
      )}
      <ErrorText message={error} />
      {id ? (
        <p className="ui-caption" aria-live="polite">{saved ? 'Saved.' : 'Changes save when you leave a box.'}</p>
      ) : (
        <button className="btn-primary block" onClick={create}>
          Save
        </button>
      )}
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
