import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise } from '../db/db';
import { listExercises } from '../db/exercises';
import { navigate } from '../router';
import { LibraryTop } from './Library';
import { KIND_LABEL } from '../format';

export function groupByMuscle(list: Exercise[]): [string, Exercise[]][] {
  const groups = new Map<string, Exercise[]>();
  for (const e of list) {
    const g = e.muscleGroup || 'Other';
    groups.set(g, [...(groups.get(g) ?? []), e]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function ExerciseList() {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const all = useLiveQuery(() => listExercises(db, { includeArchived: showArchived }), [showArchived]);

  const term = search.trim().toLowerCase();
  const shown = (all ?? []).filter(
    (e) => !term || `${e.name} ${e.muscleGroup} ${e.equipment}`.toLowerCase().includes(term),
  );

  return (
    <div className="screen">
      <LibraryTop
        part="exercises"
        action={
          <button className="btn-primary small" onClick={() => navigate('/exercises/new')}>
            + New
          </button>
        }
      />
      <input
        className="search"
        type="search"
        placeholder="Search exercises"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search exercises"
      />
      <label className="toggle">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>
      {all && shown.length === 0 && <p className="muted">No exercises match.</p>}
      {groupByMuscle(shown).map(([group, items]) => (
        <section key={group}>
          <h2 className="group-title">{group}</h2>
          <ul className="list">
            {items.map((e) => (
              <li key={e.id}>
                <button className="row" onClick={() => navigate(`/exercises/${e.id}/history`)}>
                  <span className="row-main">
                    {e.name}
                    {e.archived && <span className="tag">archived</span>}
                  </span>
                  <span className="row-sub">
                    {e.equipment || '—'} · {KIND_LABEL[e.kind]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
