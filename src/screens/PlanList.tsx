import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { createPlan, listPlans } from '../db/plans';
import { navigate } from '../router';
import { attempt, ErrorText, Header } from './common';

export function PlanList() {
  const plans = useLiveQuery(async () => {
    const [list, entries] = await Promise.all([listPlans(db), db.planExercises.toArray()]);
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.planId, (counts.get(e.planId) ?? 0) + 1);
    return list.map((p) => ({ ...p, count: counts.get(p.id) ?? 0 }));
  }, []);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    let id = '';
    const ok = await attempt(async () => {
      id = await createPlan(db, name);
    }, setError);
    if (ok) {
      setName('');
      navigate(`/plans/${id}`);
    }
  };

  return (
    <div className="screen">
      <Header title="Plans" />
      <ul className="list">
        {(plans ?? []).map((p) => (
          <li key={p.id}>
            <button className="row" onClick={() => navigate(`/plans/${p.id}`)}>
              <span className="row-main">{p.name}</span>
              <span className="row-sub">
                {p.count} exercise{p.count === 1 ? '' : 's'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="inline-form">
        <input placeholder="New plan name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New plan name" />
        <button className="btn-primary" onClick={add}>
          Create
        </button>
      </div>
      <ErrorText message={error} />
    </div>
  );
}
