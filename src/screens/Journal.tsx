import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { getDayNote, RATINGS, saveDayNote, setSessionNote, tapDayRating, type Rating } from '../db/journal';
import { ErrorText } from './common';

/**
 * A text box that saves as you type: shortly after typing stops, when the box
 * loses focus, when the app goes to the background, and when the screen
 * closes, so the last words are never lost.
 */
function AutoSaveText(props: { label: string; value: string; placeholder?: string; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState(props.value);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef(props.value);
  const latest = useRef(text);
  const timer = useRef<number | undefined>(undefined);
  const onSave = useRef(props.onSave);
  onSave.current = props.onSave;
  latest.current = text;

  const flush = () => {
    window.clearTimeout(timer.current);
    const t = latest.current;
    if (t === saved.current) return;
    const before = saved.current;
    saved.current = t;
    onSave.current(t).then(
      () => setError(null),
      (e: unknown) => {
        // Not saved: forget that it was, so the next blur, hide or close tries again.
        if (saved.current === t) saved.current = before;
        setError(e instanceof Error ? e.message : String(e));
      },
    );
  };

  // Pick up a change made elsewhere (another tab, a restore) while not typing here.
  useEffect(() => {
    if (props.value !== saved.current && latest.current === saved.current) {
      saved.current = props.value;
      setText(props.value);
    }
  }, [props.value]);

  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  return (
    <label className="field">
      <span>{props.label}</span>
      <textarea
        className="note-box"
        rows={3}
        value={text}
        placeholder={props.placeholder}
        onChange={(e) => {
          setText(e.target.value);
          latest.current = e.target.value;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(flush, 400);
        }}
        onBlur={flush}
      />
      <ErrorText message={error} />
    </label>
  );
}

/** The workout's own note, in the logging screen (R-07.1). */
export function WorkoutNote({ sessionId, value }: { sessionId: string; value: string }) {
  return (
    <section className="card">
      <AutoSaveText
        label="Note"
        value={value}
        placeholder="How did it go? Anything to remember next time?"
        onSave={(t) => setSessionNote(db, sessionId, t)}
      />
    </section>
  );
}

const LABEL: Record<Rating, string> = { energy: 'Energy', sleep: 'Sleep', soreness: 'Soreness' };

/** The day note on Today and date pages (R-07.2): three 1–5 ratings and free text, all optional. */
export function DayNoteSection({ date }: { date: string }) {
  const note = useLiveQuery(() => getDayNote(db, date), [date]);
  const [error, setError] = useState<string | null>(null);
  if (!note) return null;
  const rate = (r: Rating, n: number) =>
    tapDayRating(db, date, r, n).then(
      () => setError(null),
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  return (
    <section className="card day-note" aria-label="Day note">
      <div className="card-title">Day note</div>
      {RATINGS.map((r) => (
        <div key={r} className="rating-row" role="group" aria-label={LABEL[r]}>
          <span className="rating-label">{LABEL[r]}</span>
          <div className="rating-buttons">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={note[r] === n ? 'active' : ''} aria-pressed={note[r] === n} onClick={() => rate(r, n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="small-print muted">1 = low, 5 = high. Tap a chosen number again to clear it.</p>
      <AutoSaveText key={date} label="Notes" value={note.note} placeholder="Anything about today" onSave={(t) => saveDayNote(db, date, { note: t })} />
      <ErrorText message={error} />
    </section>
  );
}
