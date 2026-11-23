import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Metric, type MetricEntry } from '../db/db';
import {
  addCustomMetric,
  addPhoto,
  deleteEntry,
  deletePhoto,
  entriesFor,
  entryOn,
  formatMetric,
  latestEntry,
  listMetrics,
  listPhotos,
  parseShown,
  renameMetric,
  rollingAverage,
  saveEntry,
  setMetricEnabled,
  shownMetrics,
  toShown,
  unitLabel,
  updateEntry,
} from '../db/body';
import { formatDate, todayLocal } from '../db/dates';
import { getUnit, type Unit } from '../db/units';
import { navigate } from '../router';
import { attempt, ErrorText, Header } from './common';
import { LineChart } from './LineChart';
import { StatsCards } from './Stats';

// ---------- Body tab ----------

/** The Body tab (W-11): bodyweight, height and every switched-on metric with its latest value. */
export function BodyList() {
  const data = useLiveQuery(async () => {
    const [metrics, unit, all] = await Promise.all([shownMetrics(db), getUnit(db), listMetrics(db)]);
    const latest = await Promise.all(metrics.map((m) => latestEntry(db, m.id))); // one indexed read each
    const photosOn = all.find((m) => m.id === 'photos')?.enabled ?? false;
    const photoCount = photosOn ? await db.photos.count() : 0;
    return { metrics, latest, unit, photosOn, photoCount };
  }, []);
  if (!data) return <div className="screen"><Header title="Stats" /></div>;
  return (
    <div className="screen">
      <Header title="Stats" action={<button className="link" onClick={() => navigate('/settings')}>Settings</button>} />
      <StatsCards />
      <div className="section-head"><h2>Body</h2></div>
      <ul className="list">
        {data.metrics.map((m, i) => {
          const e = data.latest[i];
          return (
            <li key={m.id}>
              <button className="row" onClick={() => navigate(`/body/${m.id}`)}>
                <span className="row-main">{m.name}</span>
                <span className="row-sub">{e ? `${formatMetric(m, e.value, data.unit)} · ${formatDate(e.date)}` : 'No entries yet'}</span>
              </button>
            </li>
          );
        })}
        {data.photosOn && (
          <li>
            <button className="row" onClick={() => navigate('/body/photos')}>
              <span className="row-main">Progress photos</span>
              <span className="row-sub">{data.photoCount === 0 ? 'No photos yet' : `${data.photoCount} ${data.photoCount === 1 ? 'photo' : 'photos'}`}</span>
            </button>
          </li>
        )}
      </ul>
      <p className="small-print muted">Switch on measurements, body fat, photos or your own metrics in Settings → Body metrics.</p>
    </div>
  );
}

// ---------- one metric ----------

function ValueInput(props: { metric: Metric; unit: Unit; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <div className="input-unit">
        <input inputMode="decimal" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
        <span className="muted">{unitLabel(props.metric, props.unit)}</span>
      </div>
    </label>
  );
}

/** Height in feet and inches when the unit is lb; one box otherwise. */
function HeightInput(props: { unit: Unit; ft: string; inch: string; onChange: (ft: string, inch: string) => void }) {
  return (
    <div className="field" role="group" aria-label="Height">
      <span>Height</span>
      <div className="height-boxes">
        <div className="input-unit">
          <input inputMode="numeric" aria-label="Feet" value={props.ft} onChange={(e) => props.onChange(e.target.value, props.inch)} />
          <span className="muted">ft</span>
        </div>
        <div className="input-unit">
          <input inputMode="decimal" aria-label="Inches" value={props.inch} onChange={(e) => props.onChange(props.ft, e.target.value)} />
          <span className="muted">in</span>
        </div>
      </div>
    </div>
  );
}

const shownText = (m: Metric, stored: number, unit: Unit) => String(Math.round(toShown(m.kind, stored, unit) * 10) / 10);

/** Turn the boxes into a stored value (inches for height). */
function readValue(m: Metric, unit: Unit, text: string, ft: string, inch: string, current: number | null): number {
  if (m.id === 'height' && unit === 'lb') {
    const f = Number(ft || '0');
    const i = Number((inch || '0').replace(',', '.'));
    if (!Number.isFinite(f) || !Number.isFinite(i) || (ft.trim() === '' && inch.trim() === '')) throw new Error('Enter your height.');
    const total = f * 12 + i;
    return current !== null && Math.abs(total - current) < 0.05 ? current : total;
  }
  return parseShown(m.kind, text, unit, current);
}

/** A metric's page: add an entry, its chart, and its history with edit and delete (R-10.1, R-10.3, R-10.5). */
export function MetricPage({ metricId }: { metricId: string }) {
  const data = useLiveQuery(async () => {
    const metric = await db.metrics.get(metricId);
    if (!metric) return null;
    return { metric, entries: await entriesFor(db, metricId), unit: await getUnit(db) };
  }, [metricId]);
  const [date, setDate] = useState(todayLocal());
  const [text, setText] = useState('');
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [confirm, setConfirm] = useState<{ value: number; old: MetricEntry } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const points = useMemo(() => {
    if (!data) return [];
    const { metric, entries, unit } = data;
    const asc = [...entries].reverse();
    const avg = metric.id === 'bodyweight' ? new Map(rollingAverage(asc).map((a) => [a.date, a.value])) : null;
    return asc.map((e) => ({
      date: e.date,
      values: avg ? [toShown(metric.kind, e.value, unit), toShown(metric.kind, avg.get(e.date)!, unit)] : [toShown(metric.kind, e.value, unit)],
    }));
  }, [data]);

  if (data === undefined) return <div className="screen"><Header title="Stats" back="/body" /></div>;
  if (data === null) {
    return (
      <div className="screen">
        <Header title="Stats" back="/body" />
        <p className="muted">This metric no longer exists.</p>
      </div>
    );
  }
  const { metric, entries, unit } = data;
  const isHeightFtIn = metric.id === 'height' && unit === 'lb';

  const clear = () => {
    setText('');
    setFt('');
    setInch('');
    setConfirm(null);
  };

  const save = async () => {
    setError(null);
    let value: number;
    try {
      value = readValue(metric, unit, text, ft, inch, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    const old = await entryOn(db, metric.id, date);
    if (old) {
      setConfirm({ value, old });
      return;
    }
    if (await attempt(() => saveEntry(db, metric.id, date, value), setError)) clear();
  };

  const replace = async () => {
    if (confirm && (await attempt(() => saveEntry(db, metric.id, confirm.old.date, confirm.value), setError))) clear();
  };

  return (
    <div className="screen">
      <Header title={metric.name} back="/body" />
      <section className="card stack">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} max={todayLocal()} onChange={(e) => { setDate(e.target.value); setConfirm(null); }} />
        </label>
        {isHeightFtIn ? (
          <HeightInput unit={unit} ft={ft} inch={inch} onChange={(f, i) => { setFt(f); setInch(i); }} />
        ) : (
          <ValueInput metric={metric} unit={unit} value={text} onChange={setText} label={metric.name} />
        )}
        {confirm ? (
          <div className="banner">
            <p>
              Replace {formatMetric(metric, confirm.old.value, unit)} on {formatDate(confirm.old.date)} with {formatMetric(metric, confirm.value, unit)}?
            </p>
            <div className="button-row two">
              <button className="btn-primary" onClick={replace}>Replace</button>
              <button className="btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn-primary block" onClick={save}>Save</button>
        )}
        <ErrorText message={error} />
      </section>

      {points.length > 0 && (
        <section className="card">
          <div className="card-title">Chart</div>
          <LineChart
            points={points}
            series={metric.id === 'bodyweight' ? [{ label: 'Entries', style: 'dots' }, { label: '7-day average', style: 'line' }] : [{ label: metric.name, style: 'both' }]}
            unitLabel={unitLabel(metric, unit)}
            gapDays={metric.id === 'bodyweight' ? 7 : undefined}
          />
        </section>
      )}

      <section className="card">
        <div className="card-title">History</div>
        {entries.length === 0 && <p className="muted">No entries yet.</p>}
        <ul className="mini-list entry-list">
          {entries.map((e) =>
            editing === e.id ? (
              <EntryEditor key={e.id} metric={metric} unit={unit} entry={e} onDone={() => setEditing(null)} />
            ) : (
              <li key={e.id}>
                <button className="entry-row" onClick={() => setEditing(e.id)}>
                  <span>{formatDate(e.date)}</span>
                  <span>{formatMetric(metric, e.value, unit)}</span>
                </button>
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  );
}

function EntryEditor({ metric, unit, entry, onDone }: { metric: Metric; unit: Unit; entry: MetricEntry; onDone: () => void }) {
  const [date, setDate] = useState(entry.date);
  const ftIn = metric.id === 'height' && unit === 'lb';
  const [text, setText] = useState(shownText(metric, entry.value, unit));
  const [ft, setFt] = useState(String(Math.floor(entry.value / 12 + 1e-9)));
  const [inch, setInch] = useState(String(Math.round((entry.value - Math.floor(entry.value / 12 + 1e-9) * 12) * 10) / 10));
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    let value: number;
    try {
      value = readValue(metric, unit, text, ft, inch, entry.value);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    if (await attempt(() => updateEntry(db, entry.id, date, value), setError)) onDone();
  };
  return (
    <li className="entry-editor stack">
      <label className="field">
        <span>Date</span>
        <input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
      </label>
      {ftIn ? (
        <HeightInput unit={unit} ft={ft} inch={inch} onChange={(f, i) => { setFt(f); setInch(i); }} />
      ) : (
        <ValueInput metric={metric} unit={unit} value={text} onChange={setText} label="Value" />
      )}
      <div className="button-row">
        <button className="btn-primary" onClick={save}>Save</button>
        <button className="btn-secondary" onClick={onDone}>Cancel</button>
        <button className="btn-danger" onClick={async () => { if (await attempt(() => deleteEntry(db, entry.id), setError)) onDone(); }}>
          Delete
        </button>
      </div>
      <ErrorText message={error} />
    </li>
  );
}

// ---------- photos ----------

/** Shrink a picked photo to at most `max` pixels on the long side, as JPEG. */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
  } catch {
    // Older Safari: decode through an <img>, which also applies the photo's rotation.
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('unreadable'));
        img.src = url;
      });
    } catch {
      URL.revokeObjectURL(url);
      throw new Error('This photo could not be read. Try another one, or take it again.');
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  }
}

async function shrink(file: File, max = 1600): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await decode(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(img.source, 0, 0, width, height);
  img.done();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('The photo could not be read.'))), 'image/jpeg', 0.82));
  return { blob, width, height };
}

/** An object URL for a blob, released when no longer shown. */
function useBlobUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function Thumb({ blob, onOpen, label }: { blob: Blob; onOpen: () => void; label: string }) {
  const url = useBlobUrl(blob);
  return (
    <button className="thumb" onClick={onOpen} aria-label={label}>
      {url && <img src={url} alt="" />}
    </button>
  );
}

/** Progress photos (R-10.6): taken or picked on the phone, kept only on the phone, by date. */
export function PhotosPage() {
  const photos = useLiveQuery(() => listPhotos(db), []);
  const [date, setDate] = useState(todayLocal());
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const shown = photos?.find((p) => p.id === open);
  const bigUrl = useBlobUrl(shown?.image);

  const picked = async (list: FileList | null) => {
    // Copy the files first: clearing the picker empties its live file list.
    const files = Array.from(list ?? []);
    if (picker.current) picker.current.value = '';
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of files) {
        const { blob, width, height } = await shrink(f);
        await addPhoto(db, date, blob, width, height);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The photo could not be added.');
    } finally {
      setBusy(false);
    }
  };

  const byDate = new Map<string, NonNullable<typeof photos>>();
  for (const p of photos ?? []) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);

  return (
    <div className="screen">
      <Header title="Progress photos" back="/body" />
      <section className="card stack">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="btn-primary block" onClick={() => picker.current?.click()} disabled={busy}>
          {busy ? 'Adding…' : 'Add photo'}
        </button>
        <input ref={picker} type="file" accept="image/*" multiple hidden onChange={(e) => void picked(e.target.files)} />
        <p className="small-print muted">Photos stay on this phone. Backups include them, so backup files get bigger.</p>
        <ErrorText message={error} />
      </section>
      {photos && photos.length === 0 && <p className="muted">No photos yet.</p>}
      {[...byDate.entries()].map(([d, ps]) => (
        <section key={d} className="card">
          <div className="card-title">{formatDate(d)}</div>
          <div className="thumbs">
            {ps.map((p) => (
              <Thumb key={p.id} blob={p.image} onOpen={() => setOpen(p.id)} label={`Photo from ${formatDate(d)}`} />
            ))}
          </div>
        </section>
      ))}
      {shown && (
        <div className="photo-view" role="dialog" aria-label="Photo">
          {bigUrl && <img src={bigUrl} alt={`Photo from ${formatDate(shown.date)}`} />}
          <div className="button-row two">
            <button className="btn-secondary" onClick={() => setOpen(null)}>Close</button>
            <button
              className="btn-danger"
              onClick={async () => {
                if (window.confirm('Delete this photo? This cannot be undone.') && (await attempt(() => deletePhoto(db, shown.id), setError))) setOpen(null);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Settings → Body metrics ----------

/** Settings section: switch optional metrics on and off, add and rename custom ones (R-10.4). */
export function BodyMetricsSection() {
  const metrics = useLiveQuery(() => listMetrics(db), []);
  const [name, setName] = useState('');
  const [unitText, setUnitText] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!metrics) return null;
  const optional = metrics.filter((m) => !m.alwaysOn);
  return (
    <section className="stack" aria-label="Body metrics">
      <h2>Body metrics</h2>
      <p className="small-print muted">Bodyweight and height are always shown. Switched-off metrics are hidden; their entries are kept.</p>
      <ul className="list switch-list">
        {optional.map((m) =>
          renaming?.id === m.id ? (
            <li key={m.id} className="stack">
              <input aria-label="New name" value={renaming.name} onChange={(e) => setRenaming({ id: m.id, name: e.target.value })} />
              <div className="button-row two">
                <button className="btn-primary" onClick={async () => { if (await attempt(() => renameMetric(db, m.id, renaming.name), setError)) setRenaming(null); }}>Save</button>
                <button className="btn-secondary" onClick={() => setRenaming(null)}>Cancel</button>
              </div>
            </li>
          ) : (
            <li key={m.id} className="switch-row">
              <label className="switch-label">
                <input type="checkbox" checked={m.enabled} onChange={(e) => attempt(() => setMetricEnabled(db, m.id, e.target.checked), setError)} />
                <span>
                  {m.name}
                  {m.kind === 'custom' && <span className="muted"> ({m.unit})</span>}
                </span>
              </label>
              {!m.builtIn && (
                <button className="link" onClick={() => setRenaming({ id: m.id, name: m.name })}>Rename</button>
              )}
            </li>
          ),
        )}
      </ul>
      <div className="card stack">
        <div className="card-title">Add your own metric</div>
        <label className="field">
          <span>Name</span>
          <input value={name} placeholder="e.g. Resting HR" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Unit</span>
          <input value={unitText} placeholder="e.g. bpm" onChange={(e) => setUnitText(e.target.value)} />
        </label>
        <button
          className="btn-secondary block"
          onClick={async () => {
            if (await attempt(() => addCustomMetric(db, name, unitText), setError)) {
              setName('');
              setUnitText('');
            }
          }}
        >
          Add metric
        </button>
      </div>
      <ErrorText message={error} />
    </section>
  );
}
