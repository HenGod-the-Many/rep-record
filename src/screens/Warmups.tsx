import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Session, type WarmupMove } from '../db/db';
import {
  addMove,
  createWarmup,
  deleteWarmup,
  listWarmups,
  moveAmount,
  plansUsingWarmup,
  removeMove,
  renameWarmup,
  reorderMove,
  setPlanWarmup,
  setWarmupRounds,
  toggleWarmupMove,
  updateMove,
} from '../db/warmups';
import { navigate } from '../router';
import { attempt, ErrorText, Header, RoundsStepper } from './common';
import { Icon } from '../ui/icons';
import { MoreMenu } from '../ui/components';
import { LibraryTop } from './Library';

/** Plans tab → Warm-ups: the list of routines (W-16). */
export function WarmupList() {
  const warmups = useLiveQuery(() => listWarmups(db), []);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    let id = '';
    if (await attempt(async () => { id = await createWarmup(db, name); }, setError)) {
      setName('');
      navigate(`/warmups/${id}`);
    }
  };
  return (
    <div className="screen">
      <LibraryTop part="warmups" />
      <p className="small-print muted">Attach a warm-up to a workout and it comes first when you start that workout.</p>
      <ul className="list">
        {(warmups ?? []).map((w) => (
          <li key={w.id}>
            <button className="row" onClick={() => navigate(`/warmups/${w.id}`)}>
              <span className="row-main">{w.name}</span>
              <span className="row-sub">{w.moves.length} {w.moves.length === 1 ? 'move' : 'moves'}</span>
            </button>
          </li>
        ))}
      </ul>
      {warmups && warmups.length === 0 && <p className="muted">No warm-ups yet.</p>}
      <div className="inline-form">
        <input placeholder="New warm-up name" aria-label="New warm-up name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" onClick={add}>Create</button>
      </div>
      <ErrorText message={error} />
    </div>
  );
}

/** The boxes for one move: name, then reps or a time (minutes and seconds). */
function MoveForm(props: { initial?: WarmupMove; submitLabel: string; onSubmit: (m: WarmupMove) => Promise<boolean>; onCancel?: () => void }) {
  const i = props.initial;
  const [name, setName] = useState(i?.name ?? '');
  const [timed, setTimed] = useState(i ? i.seconds !== null : false);
  const [count, setCount] = useState(i?.reps !== null && i?.reps !== undefined ? String(i.reps) : '10');
  const [min, setMin] = useState(i?.seconds ? String(Math.floor(i.seconds / 60)) : '1');
  const [sec, setSec] = useState(i?.seconds ? String(i.seconds % 60) : '0');
  const submit = async () => {
    const move: WarmupMove = timed
      ? { name, reps: null, seconds: Number(min || 0) * 60 + Number(sec || 0) }
      : { name, reps: Number(count), seconds: null };
    if (await props.onSubmit(move) && !props.initial) {
      setName('');
    }
  };
  return (
    <div className="stack move-form">
      <input aria-label="Move name" placeholder="e.g. Arm circles" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="segmented two" role="group" aria-label="Reps or time">
        <button className={!timed ? 'active' : ''} aria-pressed={!timed} onClick={() => setTimed(false)}>Reps</button>
        <button className={timed ? 'active' : ''} aria-pressed={timed} onClick={() => setTimed(true)}>Time</button>
      </div>
      {timed ? (
        <div className="height-boxes">
          <div className="input-unit">
            <input inputMode="numeric" aria-label="Minutes" value={min} onChange={(e) => setMin(e.target.value)} />
            <span className="muted">min</span>
          </div>
          <div className="input-unit">
            <input inputMode="numeric" aria-label="Seconds" value={sec} onChange={(e) => setSec(e.target.value)} />
            <span className="muted">s</span>
          </div>
        </div>
      ) : (
        <div className="input-unit">
          <input inputMode="numeric" aria-label="Reps" value={count} onChange={(e) => setCount(e.target.value)} />
          <span className="muted">reps</span>
        </div>
      )}
      <div className={props.onCancel ? 'button-row two' : ''}>
        <button className={`btn-primary${props.onCancel ? '' : ' block'}`} onClick={submit}>{props.submitLabel}</button>
        {props.onCancel && <button className="btn-secondary" onClick={props.onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

/** One routine: its moves (edit, reorder, remove), add a move, rename, delete. */
export function WarmupEdit({ warmupId }: { warmupId: string }) {
  const data = useLiveQuery(async () => {
    const w = await db.warmups.get(warmupId);
    return w ? { w, used: await plansUsingWarmup(db, warmupId), dateCopies: await db.plans.filter((p) => !!p.hidden && p.warmupId === warmupId).count() } : null;
  }, [warmupId]);
  const [editing, setEditing] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (data === undefined) return <div className="screen"><Header title="Warm-up" back="/warmups" /></div>;
  if (data === null) {
    return (
      <div className="screen">
        <Header title="Warm-up" back="/warmups" />
        <p className="muted">This warm-up no longer exists.</p>
      </div>
    );
  }
  const { w, used, dateCopies } = data;
  const remove = async () => {
    const where = [...used, ...(dateCopies ? [`${dateCopies} edited ${dateCopies === 1 ? 'date' : 'dates'}`] : [])];
    const msg = where.length
      ? `Delete ${w.name}? It will be removed from ${where.join(', ')}. Past workouts keep it.`
      : `Delete ${w.name}?`;
    if (window.confirm(msg) && (await attempt(() => deleteWarmup(db, w.id), setError))) navigate('/warmups');
  };
  return (
    <div className="screen">
      <Header
        title={w.name}
        back="/warmups"
        action={
          <MoreMenu
            label={`More for ${w.name}`}
            items={[
              { label: 'Rename', onSelect: () => setRenaming(w.name) },
              { label: 'Delete warm-up', danger: true, onSelect: remove },
            ]}
          />
        }
      />
      {used.length > 0 && <p className="small-print muted">Used by {used.join(', ')}.</p>}
      <RoundsStepper value={w.rounds ?? 1} max={10} onChange={(n) => attempt(() => setWarmupRounds(db, w.id, n), setError)} />
      <ol className="move-list">
        {w.moves.map((m, i) =>
          editing === i ? (
            <li key={i}>
              <MoveForm
                initial={m}
                submitLabel="Save"
                onCancel={() => setEditing(null)}
                onSubmit={async (mv) => {
                  const ok = await attempt(() => updateMove(db, w.id, i, mv), setError);
                  if (ok) setEditing(null);
                  return ok;
                }}
              />
            </li>
          ) : (
            <li key={i} className="move-row">
              <button className="move-main" onClick={() => setEditing(i)}>
                <span>{m.name}</span>
                <span className="muted">{moveAmount(m)}</span>
              </button>
              <button className="icon-btn" aria-label={`Move ${m.name} up`} disabled={i === 0 || editing !== null} onClick={() => attempt(() => reorderMove(db, w.id, i, -1), setError)}><Icon name="arrow-up" size={20} /></button>
              <button className="icon-btn" aria-label={`Move ${m.name} down`} disabled={i === w.moves.length - 1 || editing !== null} onClick={() => attempt(() => reorderMove(db, w.id, i, 1), setError)}><Icon name="arrow-down" size={20} /></button>
              <button className="icon-btn" aria-label={`Remove ${m.name}`} disabled={editing !== null} onClick={() => attempt(() => removeMove(db, w.id, i), setError)}><Icon name="close" size={20} /></button>
            </li>
          ),
        )}
      </ol>
      {w.moves.length === 0 && <p className="muted">No moves yet. Add the first one below.</p>}
      <section className="card">
        <div className="card-title">Add a move</div>
        <MoveForm submitLabel="Add move" onSubmit={(m) => attempt(() => addMove(db, w.id, m), setError)} />
      </section>
      <ErrorText message={error} />
      {renaming === null ? null : (
        <div className="inline-form">
          <input aria-label="Warm-up name" value={renaming} onChange={(e) => setRenaming(e.target.value)} />
          <button className="btn-primary" onClick={async () => { if (await attempt(() => renameWarmup(db, w.id, renaming), setError)) setRenaming(null); }}>Save</button>
          <button className="btn-secondary" onClick={() => setRenaming(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/** The plan's Warm-up choice, on the plan screen. */
export function PlanWarmupChoice({ planId, value }: { planId: string; value: string | null | undefined }) {
  const warmups = useLiveQuery(() => listWarmups(db), []);
  const [error, setError] = useState<string | null>(null);
  return (
    <label className="field">
      <span>Warm-up</span>
      <select className="select" value={value ?? ''} onChange={(e) => attempt(() => setPlanWarmup(db, planId, e.target.value || null), setError)}>
        <option value="">None</option>
        {(warmups ?? []).map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
      <span className="small-print muted">
        Build warm-ups under <button className="link" onClick={() => navigate('/warmups')}>Library → Warm-ups</button>.
      </span>
      <ErrorText message={error} />
    </label>
  );
}

/** In the logging screen: the warm-up first, each move one tap to check off; folds when all are done. */
export function WarmupCard({ session }: { session: Session }) {
  const moves = session.warmupMoves ?? [];
  const rounds = session.warmupRounds ?? 1;
  const checked = new Set(session.warmupChecked ?? []);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (moves.length === 0) return null;
  // Round r's move i is position r * moves.length + i (W-19).
  const total = moves.length * rounds;
  const done = Array.from({ length: total }, (_, i) => i).every((i) => checked.has(i));
  if (done && !open) {
    return (
      <section className="card warmup-done">
        <span>✓ Warm-up done</span>
        <button className="link" onClick={() => setOpen(true)}>Show</button>
      </section>
    );
  }
  return (
    <section className="card warmup-card" aria-label="Warm-up">
      <div className="card-title">
        Warm-up
        <span className="row-sub">{[...checked].filter((i) => i < total).length} of {total}</span>
        {done && <button className="link" onClick={() => setOpen(false)}>Hide</button>}
      </div>
      {Array.from({ length: rounds }, (_, r) => (
        <div key={r}>
          {rounds > 1 && <div className="group-title">Round {r + 1} of {rounds}</div>}
          <ul className="warmup-moves">
            {moves.map((m, i) => {
              const at = r * moves.length + i;
              return (
                <li key={at}>
                  <button
                    className={`warmup-move${checked.has(at) ? ' checked' : ''}`}
                    aria-pressed={checked.has(at)}
                    aria-label={rounds > 1 ? `${m.name}, round ${r + 1}` : undefined}
                    onClick={() => attempt(() => toggleWarmupMove(db, session.id, at), setError)}
                  >
                    <span className="tick" aria-hidden>{checked.has(at) ? '✓' : ''}</span>
                    <span className="warmup-name">{m.name}</span>
                    <span className="muted">{moveAmount(m)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <ErrorText message={error} />
    </section>
  );
}
