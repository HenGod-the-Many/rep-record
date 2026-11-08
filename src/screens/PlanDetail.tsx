import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { deletePlan, duplicatePlan, getEntries, moveEntry, renamePlan } from '../db/plans';
import { navigate } from '../router';
import { attempt, ErrorText, Header } from './common';
import { formatTargets } from '../format';

export function PlanDetail({ planId }: { planId: string }) {
  const data = useLiveQuery(async () => {
    const plan = await db.plans.get(planId);
    if (!plan) return { plan: null, entries: [], exercises: new Map() };
    const entries = await getEntries(db, planId);
    const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    return { plan, entries, exercises };
  }, [planId]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!data) return <div className="screen"><Header title="Plan" back="/plans" /></div>;
  if (!data.plan) {
    return (
      <div className="screen">
        <Header title="Plan" back="/plans" />
        <p className="muted">This plan no longer exists.</p>
      </div>
    );
  }
  const { plan, entries, exercises } = data;

  const saveName = async () => {
    if (renaming === null) return;
    if (await attempt(() => renamePlan(db, planId, renaming), setError)) setRenaming(null);
  };

  const duplicate = async () => {
    const id = await duplicatePlan(db, planId);
    navigate(`/plans/${id}`);
  };

  const remove = async () => {
    if (!window.confirm(`Delete the plan "${plan.name}"? Logged sets are kept. Split days using it become rest days.`)) return;
    await deletePlan(db, planId);
    navigate('/plans');
  };

  return (
    <div className="screen">
      <Header title={plan.name} back="/plans" />
      {renaming === null ? (
        <div className="button-row">
          <button className="btn-secondary" onClick={() => setRenaming(plan.name)}>Rename</button>
          <button className="btn-secondary" onClick={duplicate}>Duplicate</button>
          <button className="btn-danger" onClick={remove}>Delete</button>
        </div>
      ) : (
        <div className="inline-form">
          <input value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label="Plan name" autoFocus />
          <button className="btn-primary" onClick={saveName}>Save</button>
          <button className="btn-secondary" onClick={() => { setRenaming(null); setError(null); }}>Cancel</button>
        </div>
      )}
      <ErrorText message={error} />

      {entries.length === 0 && <p className="muted">No exercises yet.</p>}
      <ol className="list entries">
        {entries.map((entry, i) => {
          const ex = exercises.get(entry.exerciseId);
          const alts = entry.alternateIds.map((id) => exercises.get(id)?.name).filter(Boolean);
          return (
            <li key={entry.id} className="entry">
              <button className="row" onClick={() => navigate(`/plans/${planId}/entry/${entry.id}`)}>
                <span className="row-main">
                  <span className="entry-num">{i + 1}</span>
                  {ex?.name ?? 'Unknown exercise'}
                  {ex?.archived && <span className="tag">archived</span>}
                </span>
                <span className="row-sub">
                  {ex ? formatTargets(entry, ex.kind) : ''}
                  {alts.length > 0 && ` · or ${alts.join(', ')}`}
                </span>
              </button>
              <div className="move">
                <button aria-label={`Move ${ex?.name} up`} disabled={i === 0} onClick={() => moveEntry(db, entry.id, -1)}>▲</button>
                <button aria-label={`Move ${ex?.name} down`} disabled={i === entries.length - 1} onClick={() => moveEntry(db, entry.id, 1)}>▼</button>
              </div>
            </li>
          );
        })}
      </ol>
      <button className="btn-primary block" onClick={() => navigate(`/pick?mode=add&plan=${planId}`)}>
        + Add exercise
      </button>
    </div>
  );
}
