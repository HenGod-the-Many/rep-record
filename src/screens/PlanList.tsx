import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Folder, type Plan } from '../db/db';
import { createPlan } from '../db/plans';
import { createFolder, deleteFolder, duplicateFolder, listFolders, moveFolder, plansInFolder, renameFolder } from '../db/folders';
import { navigate } from '../router';
import { attempt, ErrorText } from './common';
import { LibraryTop } from './Library';

type Counted = Plan & { count: number };

/** Folders left open, kept while the app runs so coming back from a plan keeps them open. */
const openFolders: Record<string, boolean> = {};

export function PlanList() {
  const data = useLiveQuery(async () => {
    const [folders, entries] = await Promise.all([listFolders(db), db.planExercises.toArray()]);
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.planId, (counts.get(e.planId) ?? 0) + 1);
    const withCount = (ps: Plan[]): Counted[] => ps.map((p) => ({ ...p, count: counts.get(p.id) ?? 0 }));
    const inFolders = await Promise.all(folders.map(async (f) => ({ folder: f, plans: withCount(await plansInFolder(db, f.id)) })));
    return { inFolders, loose: withCount(await plansInFolder(db, null)) };
  }, []);
  const [name, setName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [open, setOpenState] = useState<Record<string, boolean>>(() => ({ ...openFolders }));
  const setOpen = (change: (o: Record<string, boolean>) => Record<string, boolean>) =>
    setOpenState((o) => {
      const next = change(o);
      Object.assign(openFolders, next);
      return next;
    });
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    let id = '';
    if (await attempt(async () => { id = await createPlan(db, name); }, setError)) {
      setName('');
      navigate(`/plans/${id}`);
    }
  };
  const addFolder = async () => {
    let id = '';
    if (await attempt(async () => { id = await createFolder(db, folderName); }, setError)) {
      setFolderName('');
      setOpen((o) => ({ ...o, [id]: true }));
    }
  };

  const folders = data?.inFolders ?? [];
  return (
    <div className="screen">
      <LibraryTop part="workouts" />

      {folders.map(({ folder, plans }, i) => (
        <FolderGroup
          key={folder.id}
          folder={folder}
          plans={plans}
          open={!!open[folder.id]}
          first={i === 0}
          last={i === folders.length - 1}
          onToggle={() => setOpen((o) => ({ ...o, [folder.id]: !o[folder.id] }))}
          onOpenCopy={(id) => setOpen((o) => ({ ...o, [id]: true }))}
        />
      ))}

      {folders.length > 0 && <div className="group-title">Not in a folder</div>}
      <PlanRows plans={data?.loose ?? []} />

      <div className="inline-form">
        <input placeholder="New workout name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New workout name" />
        <button className="btn-primary" onClick={add}>Create</button>
      </div>
      <div className="inline-form">
        <input placeholder="New folder name" value={folderName} onChange={(e) => setFolderName(e.target.value)} aria-label="New folder name" />
        <button className="btn-secondary" onClick={addFolder}>New folder</button>
      </div>
      <ErrorText message={error} />
    </div>
  );
}

function PlanRows({ plans }: { plans: Counted[] }) {
  return (
    <ul className="list">
      {plans.map((p) => (
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
  );
}

function FolderGroup(props: {
  folder: Folder;
  plans: Counted[];
  open: boolean;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onOpenCopy: (id: string) => void;
}) {
  const { folder, plans, open } = props;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => attempt(fn, setError);

  const remove = async () => {
    const what = plans.length === 0 ? 'It is empty.' : `Its ${plans.length} workout${plans.length === 1 ? '' : 's'} will be kept, outside any folder.`;
    if (!window.confirm(`Delete the folder "${folder.name}"? ${what}`)) return;
    await run(() => deleteFolder(db, folder.id));
  };
  const copy = async () => {
    let id = '';
    if (await run(async () => { id = await duplicateFolder(db, folder.id); })) props.onOpenCopy(id);
  };
  const saveName = async () => {
    if (renaming !== null && (await run(() => renameFolder(db, folder.id, renaming)))) setRenaming(null);
  };

  return (
    <section className={`card folder${open ? ' open' : ''}`}>
      <button className="folder-head" aria-expanded={open} onClick={props.onToggle}>
        <span className="folder-icon" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="row-main">{folder.name}</span>
        <span className="row-sub">
          {plans.length} workout{plans.length === 1 ? '' : 's'}
        </span>
      </button>
      {open && (
        <>
          {plans.length === 0 ? (
            <p className="small-print muted">Empty. Open a workout and choose this folder under "Folder".</p>
          ) : (
            <PlanRows plans={plans} />
          )}
          {renaming !== null ? (
            <div className="inline-form">
              <input value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label="Folder name" autoFocus />
              <button className="btn-primary" onClick={saveName}>Save</button>
              <button className="btn-secondary" onClick={() => setRenaming(null)}>Cancel</button>
            </div>
          ) : (
            <div className="folder-actions">
              <button className="btn-secondary" onClick={() => setRenaming(folder.name)}>Rename</button>
              <button className="btn-secondary" onClick={copy}>Duplicate</button>
              <button className="btn-danger" onClick={remove}>Delete</button>
              <button className="icon-btn" aria-label={`Move ${folder.name} up`} disabled={props.first} onClick={() => run(() => moveFolder(db, folder.id, -1))}>▲</button>
              <button className="icon-btn" aria-label={`Move ${folder.name} down`} disabled={props.last} onClick={() => run(() => moveFolder(db, folder.id, 1))}>▼</button>
            </div>
          )}
          <ErrorText message={error} />
        </>
      )}
    </section>
  );
}
