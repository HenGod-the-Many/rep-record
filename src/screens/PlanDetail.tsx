import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { deletePlan, duplicatePlan, getEntries, moveEntry, renamePlan } from '../db/plans';
import { groupLabel, makeGroup, planBlocks, setGroup, takeOutOfGroup, ungroup } from '../db/groups';
import type { Exercise, GroupKind, PlanExercise } from '../db/db';
import type { Unit } from '../db/units';
import { dateOfCopy, saveCopyAsNewPlan, updatePlanEverywhere } from '../db/reschedule';
import { formatDate } from '../db/dates';
import { navigate } from '../router';
import { attempt, ErrorText, Header, RoundsStepper } from './common';
import { getUnit } from '../db/units';
import { PlanWarmupChoice } from './Warmups';
import { formatTargets } from '../format';
import { listFolders, setPlanFolder } from '../db/folders';

/** Which folder the plan is in (W-18). */
function PlanFolderChoice({ planId, value }: { planId: string; value: string | null | undefined }) {
  const folders = useLiveQuery(() => listFolders(db), []);
  const [error, setError] = useState<string | null>(null);
  return (
    <label className="field">
      <span>Folder</span>
      <select className="select" value={value ?? ''} onChange={(e) => attempt(() => setPlanFolder(db, planId, e.target.value || null), setError)}>
        <option value="">Not in a folder</option>
        {(folders ?? []).map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
      {folders && folders.length === 0 && <span className="small-print muted">Make folders at the bottom of the Plans tab.</span>}
      <ErrorText message={error} />
    </label>
  );
}

export function PlanDetail({ planId, backTo }: { planId: string; backTo?: string }) {
  const data = useLiveQuery(async () => {
    const plan = await db.plans.get(planId);
    if (!plan) return { plan: null, entries: [], exercises: new Map(), copyDate: null, sourceName: null };
    const entries = await getEntries(db, planId);
    const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    const copyDate = plan.hidden ? await dateOfCopy(db, planId) : null;
    const source = plan.sourcePlanId ? await db.plans.get(plan.sourcePlanId) : undefined;
    return { plan, entries, exercises, copyDate, sourceName: source?.name ?? null, unit: await getUnit(db) };
  }, [planId]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [keeping, setKeeping] = useState(false);
  const [newName, setNewName] = useState('');
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
  const { plan, entries, exercises, copyDate, sourceName } = data;
  const back = backTo ?? (plan.hidden ? (copyDate ? `/day/${copyDate}` : '/today') : '/plans');
  const fromScratch = plan.hidden && !plan.sourcePlanId;

  const keepEverywhere = async () => {
    if (!window.confirm(`Replace ${sourceName}'s exercises everywhere with this version? This can't be undone.`)) return;
    if (await attempt(() => updatePlanEverywhere(db, planId), setError)) navigate(back);
  };
  const keepAsNew = async () => {
    if (await attempt(() => saveCopyAsNewPlan(db, planId, newName), setError)) setKeeping(false);
  };

  const saveName = async () => {
    if (renaming === null) return;
    if (await attempt(() => renamePlan(db, planId, renaming), setError)) setRenaming(null);
  };

  const duplicate = async () => {
    const id = await duplicatePlan(db, planId);
    navigate(`/plans/${id}`);
  };

  const remove = async () => {
    if (!window.confirm(`Delete the plan "${plan.name}"? It is removed from your splits (a day left with nothing becomes rest), dates you set to only this plan go back to the split, and logged sets are kept.`)) return;
    await deletePlan(db, planId);
    navigate('/plans');
  };

  return (
    <div className="screen">
      <Header title={plan.name} back={back} />
      {plan.hidden && (
        <div className="card">
          <p className="small-print">
            {fromScratch
              ? `This workout is for ${copyDate ? formatDate(copyDate) : 'this date'} only. Save it as a plan to reuse it.`
              : `Changes here apply to ${copyDate ? formatDate(copyDate) : 'this date'} only. The ${sourceName ?? 'original'} plan is not changed.`}
          </p>
          {!keeping ? (
            <button className="btn-primary block" onClick={() => { setKeeping(true); setNewName(fromScratch ? plan.name : `${plan.name} (edited)`); }}>
              {fromScratch ? 'Save as a plan…' : 'Keep these changes…'}
            </button>
          ) : (
            <div className="stack">
              {!fromScratch && (
                <button className="btn-primary" disabled={!sourceName} onClick={keepEverywhere}>
                  Update {sourceName ?? 'the plan'} everywhere
                </button>
              )}
              <div className="inline-form">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New plan name" />
                <button className="btn-secondary" onClick={keepAsNew}>Save as new plan</button>
              </div>
              <button className="btn-secondary" onClick={() => setKeeping(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}
      <PlanWarmupChoice planId={plan.id} value={plan.warmupId} />
      {!plan.hidden && <PlanFolderChoice planId={plan.id} value={plan.folderId} />}
      {renaming === null ? (
        plan.hidden ? (
          <button className="btn-secondary block" onClick={() => setRenaming(plan.name)}>Rename</button>
        ) : (
          <div className="button-row">
            <button className="btn-secondary" onClick={() => setRenaming(plan.name)}>Rename</button>
            <button className="btn-secondary" onClick={duplicate}>Duplicate</button>
            <button className="btn-danger" onClick={remove}>Delete</button>
          </div>
        )
      ) : (
        <div className="inline-form">
          <input value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label="Plan name" autoFocus />
          <button className="btn-primary" onClick={saveName}>Save</button>
          <button className="btn-secondary" onClick={() => { setRenaming(null); setError(null); }}>Cancel</button>
        </div>
      )}
      <ErrorText message={error} />

      {entries.length === 0 && <p className="muted">No exercises yet.</p>}
      <PlanEntries planId={planId} entries={entries} exercises={exercises} unit={data.unit ?? 'lb'} />
      <button className="btn-primary block" onClick={() => navigate(`/pick?mode=add&plan=${planId}`)}>
        + Add exercise
      </button>
    </div>
  );
}

/**
 * A plan's exercises, with supersets and circuits shown as one block (W-19).
 * "Superset / circuit" picks exercises in a row to group; a group's Edit
 * changes its kind and rounds, takes an exercise out or undoes the group.
 */
function PlanEntries(props: { planId: string; entries: PlanExercise[]; exercises: Map<string, Exercise>; unit: Unit }) {
  const { planId, entries, exercises, unit } = props;
  const [picking, setPicking] = useState<Set<string> | null>(null);
  const [kind, setKind] = useState<GroupKind>('superset');
  const [rounds, setRounds] = useState(3);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blocks = planBlocks(entries);
  const position = new Map(entries.map((e, i) => [e.id, i]));
  // A member moves only within its group; others can move anywhere (they jump over a group).
  const canMove = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= entries.length) return false;
    return !entries[i].groupKey || entries[j].groupKey === entries[i].groupKey;
  };

  const row = (entry: PlanExercise, label?: string) => {
    const i = position.get(entry.id)!;
    const ex = exercises.get(entry.exerciseId);
    const alts = entry.alternateIds.map((id) => exercises.get(id)?.name).filter(Boolean);
    const selectable = picking !== null && !entry.groupKey;
    const selected = picking?.has(entry.id) ?? false;
    return (
      <li key={entry.id} className={`entry${selected ? ' selected' : ''}`}>
        <button
          className="row"
          aria-pressed={selectable ? selected : undefined}
          onClick={() => {
            if (picking === null) return navigate(`/plans/${planId}/entry/${entry.id}`);
            if (!selectable) return;
            const next = new Set(picking);
            if (selected) next.delete(entry.id);
            else next.add(entry.id);
            setPicking(next);
          }}
        >
          <span className="row-main">
            {selectable && <span className={`pick-box${selected ? ' on' : ''}`} aria-hidden="true">{selected ? '✓' : ''}</span>}
            <span className="entry-num">{label ?? i + 1}</span>
            {ex?.name ?? 'Unknown exercise'}
            {ex?.archived && <span className="tag">archived</span>}
          </span>
          <span className="row-sub">
            {ex ? formatTargets(entry, ex.kind, unit) : ''}
            {alts.length > 0 && ` · or ${alts.join(', ')}`}
          </span>
        </button>
        {picking === null && (
          <div className="move">
            <button aria-label={`Move ${ex?.name} up`} disabled={!canMove(i, -1)} onClick={() => moveEntry(db, entry.id, -1)}>▲</button>
            <button aria-label={`Move ${ex?.name} down`} disabled={!canMove(i, 1)} onClick={() => moveEntry(db, entry.id, 1)}>▼</button>
          </div>
        )}
      </li>
    );
  };

  const make = async () => {
    if (!picking) return;
    if (await attempt(() => makeGroup(db, planId, [...picking], kind, rounds), setError)) setPicking(null);
  };

  return (
    <>
      <ol className="list entries">
        {blocks.map((b) =>
          b.type === 'single' ? (
            row(b.entry)
          ) : (
            <li key={b.key} className="group-block">
              <div className="group-block-head">
                <span>
                  <strong>{groupLabel(b.kind)}</strong> · {b.rounds} rounds
                </span>
                {picking === null && (
                  <button className="btn-secondary small-btn" aria-expanded={editing === b.key} onClick={() => setEditing(editing === b.key ? null : b.key)}>
                    Edit
                  </button>
                )}
              </div>
              {editing === b.key && (
                <GroupEditor
                  planId={planId}
                  groupKey={b.key}
                  kind={b.kind}
                  rounds={b.rounds}
                  members={b.entries.map((e) => ({ id: e.id, name: exercises.get(e.exerciseId)?.name ?? 'Unknown exercise' }))}
                  onDone={() => setEditing(null)}
                />
              )}
              <ol className="list entries">{b.entries.map((e, n) => row(e, `A${n + 1}`))}</ol>
            </li>
          ),
        )}
      </ol>
      {picking === null ? (
        entries.length >= 2 && (
          <button className="btn-secondary block" onClick={() => { setPicking(new Set()); setEditing(null); setError(null); }}>
            Superset / circuit…
          </button>
        )
      ) : (
        <div className="card group-maker">
          <p className="small-print">Tap two or more exercises that are next to each other.</p>
          <KindChoice value={kind} onChange={setKind} />
          <RoundsStepper value={rounds} onChange={setRounds} />
          <div className="button-row">
            <button className="btn-primary" disabled={picking.size < 2} onClick={make}>
              Make {groupLabel(kind).toLowerCase()}
            </button>
            <button className="btn-secondary" onClick={() => { setPicking(null); setError(null); }}>Cancel</button>
          </div>
        </div>
      )}
      <ErrorText message={error} />
    </>
  );
}

function KindChoice({ value, onChange }: { value: GroupKind; onChange: (k: GroupKind) => void }) {
  return (
    <div className="segmented two" role="group" aria-label="Kind">
      {(['superset', 'circuit'] as const).map((k) => (
        <button key={k} className={value === k ? 'active' : ''} aria-pressed={value === k} onClick={() => onChange(k)}>
          {groupLabel(k)}
        </button>
      ))}
    </div>
  );
}

function GroupEditor(props: { planId: string; groupKey: string; kind: GroupKind; rounds: number; members: { id: string; name: string }[]; onDone: () => void }) {
  const [kind, setKind] = useState(props.kind);
  const [rounds, setRounds] = useState(props.rounds);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    if (await attempt(fn, setError)) props.onDone();
  };
  return (
    <div className="group-editor">
      <KindChoice value={kind} onChange={setKind} />
      <RoundsStepper value={rounds} onChange={setRounds} />
      <div className="button-row">
        <button className="btn-primary" onClick={() => run(() => setGroup(db, props.planId, props.groupKey, kind, rounds))}>Save</button>
        <button className="btn-secondary" onClick={() => run(() => ungroup(db, props.planId, props.groupKey))}>Ungroup</button>
      </div>
      <ul className="mini-list">
        {props.members.map((m) => (
          <li key={m.id}>
            <span>{m.name}</span>
            <button className="link" onClick={() => run(() => takeOutOfGroup(db, m.id))}>Take out</button>
          </li>
        ))}
      </ul>
      <ErrorText message={error} />
    </div>
  );
}
