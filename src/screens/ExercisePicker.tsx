import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { listExercises } from '../db/exercises';
import { addAlternate, addEntry, replaceEntryExercise } from '../db/plans';
import { navigate } from '../router';
import { attempt, ErrorText, Header } from './common';
import { groupByMuscle } from './ExerciseList';

type Mode = 'add' | 'replace' | 'alt';

const TITLES: Record<Mode, string> = {
  add: 'Add exercise',
  replace: 'Replace with…',
  alt: 'Add alternate',
};

/** Choose an exercise from the active library, then add/replace/alternate in a plan. */
export function ExercisePicker({ query }: { query: URLSearchParams }) {
  const mode = (query.get('mode') ?? 'add') as Mode;
  const planId = query.get('plan') ?? '';
  const entryId = query.get('entry') ?? '';
  const back = mode === 'add' ? `/plans/${planId}` : `/plans/${planId}/entry/${entryId}`;

  const exercises = useLiveQuery(() => listExercises(db), []);
  const entry = useLiveQuery(() => (entryId ? db.planExercises.get(entryId) : undefined), [entryId]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const excluded = new Set<string>(entry ? [entry.exerciseId, ...entry.alternateIds] : []);
  const term = search.trim().toLowerCase();
  const shown = (exercises ?? []).filter(
    (e) => !excluded.has(e.id) && (!term || `${e.name} ${e.muscleGroup} ${e.equipment}`.toLowerCase().includes(term)),
  );

  const choose = async (exerciseId: string) => {
    const ok = await attempt(async () => {
      if (mode === 'add') {
        const ex = await db.exercises.get(exerciseId);
        const timed = ex?.kind === 'timed';
        await addEntry(db, planId, exerciseId, timed ? { targetSets: 3, repMin: 30, repMax: 60 } : undefined);
      } else if (mode === 'replace') {
        await replaceEntryExercise(db, entryId, exerciseId);
      } else {
        await addAlternate(db, entryId, exerciseId);
      }
    }, setError);
    if (ok) navigate(back, { replace: true });
  };

  return (
    <div className="screen">
      <Header title={TITLES[mode] ?? 'Choose exercise'} back={back} />
      <input
        className="search"
        type="search"
        placeholder="Search exercises"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search exercises"
        autoFocus
      />
      <ErrorText message={error} />
      {groupByMuscle(shown).map(([group, items]) => (
        <section key={group}>
          <h2 className="group-title">{group}</h2>
          <ul className="list">
            {items.map((e) => (
              <li key={e.id}>
                <button className="row" onClick={() => choose(e.id)}>
                  <span className="row-main">{e.name}</span>
                  <span className="row-sub">{e.equipment || '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="muted small-print">Not listed? Create it under Exercises first.</p>
    </div>
  );
}
