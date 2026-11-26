import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type ExerciseKind, type PlanExercise, type Session, type SetLog, type SetPart } from '../db/db';
import { formatDate, timeLabel } from '../db/dates';
import { getEntries } from '../db/plans';
import {
  activeExerciseId,
  adjustSet,
  changeWeightAt,
  deleteSet,
  finishSession,
  logSet,
  moveSlot,
  orderedEntries,
  workoutUnits,
  prefillFor,
  reopenSession,
  slotDone,
  setDifficulty,
  setToFailure,
  setTotalReps,
  swapChoices,
  swapForSession,
  totalReps,
  updateSetParts,
  type Prefill,
} from '../db/logging';
import { displayNumber, formatWeight, parseWeight, quickDrop, stepWeight, type Unit } from '../db/units';
import { formatTargets } from '../format';
import { navigate } from '../router';
import { WorkoutNote } from './Journal';
import { WarmupCard } from './Warmups';
import { ActivityCard } from './ActivityCard';
import { attempt, CardTitle, ErrorText, Header, MoveButtons, type SlotControls } from './common';
import { Icon } from '../ui/icons';
import { foldedByDefault, foldSummary } from '../db/fold';
import { groupLabel } from '../db/groups';
import type { GroupKind } from '../db/db';

const EMPTY: SetPart = { weightLb: null, reps: null, seconds: null };

/** "135 lb × 8", "+25 lb × 8", "12 reps", "60 s"; several parts joined with →. */
export function partsText(parts: SetPart[], kind: ExerciseKind, unit: Unit): string {
  return parts
    .map((p) => {
      if (kind === 'activity') return `${Math.round((p.seconds ?? 0) / 60)} min`;
      if (kind === 'timed') return `${p.seconds ?? '–'} s`;
      if (kind === 'bodyweight') return p.weightLb ? `+${formatWeight(p.weightLb, unit)} × ${p.reps ?? '–'}` : `${p.reps ?? '–'} reps`;
      return `${p.weightLb === null ? '–' : formatWeight(p.weightLb, unit)} × ${p.reps ?? '–'}`;
    })
    .join(' → ');
}

/**
 * Typed-but-unlogged numbers and added rows, kept for the life of the app so
 * they survive leaving the logging screen (for example to look at History)
 * and coming back. Keyed by workout, plan slot and exercise.
 */
const cardDrafts = new Map<string, { drafts: Map<string, SetPart>; extra: number }>();
function cardDraftsFor(key: string) {
  let d = cardDrafts.get(key);
  if (!d) cardDrafts.set(key, (d = { drafts: new Map(), extra: 0 }));
  return d;
}

/** The logging screen: one card per exercise in the plan, sets saved the moment they are logged. */
export function LogWorkout({ sessionId, back = '/today' }: { sessionId: string; back?: string }) {
  const data = useLiveQuery(async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) return null;
    const entries = session.planId ? await getEntries(db, session.planId) : [];
    const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    const logs = await db.setLogs.where('sessionId').equals(sessionId).toArray();
    const unitSetting = await db.settings.get('unit');
    const unit: Unit = unitSetting?.value === 'kg' ? 'kg' : 'lb';
    return { session, entries, exercises, logs, unit };
  }, [sessionId]);
  const [error, setError] = useState<string | null>(null);
  /** Plan slot id -> folded. Only on screen; nothing is saved. */
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  /** Slots already done when the screen opened; they start folded. */
  const doneAtOpen = useRef<Set<string> | null>(null);

  if (data === undefined) return <div className="screen"><Header title="Workout" back={back} /></div>;
  if (data === null) {
    return (
      <div className="screen">
        <Header title="Workout" back={back} />
        <p className="banner">This workout no longer exists.</p>
      </div>
    );
  }
  const { session, entries, exercises, logs, unit } = data;
  const entryIds = new Set(entries.map((e) => e.id));
  const orphans = logs.filter((l) => !l.planExerciseId || !entryIds.has(l.planExerciseId));
  const ordered = orderedEntries(session, entries);
  const slots = ordered
    .map((entry) => {
      const exId = activeExerciseId(session, entry);
      const ex = exercises.get(exId);
      if (!ex) return null;
      const own = logs.filter((l) => l.planExerciseId === entry.id && l.exerciseId === exId);
      return { entry, exId, ex, own, done: slotDone(entry, own, ex.kind) };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  // Blocks on screen: one exercise, or a whole superset/circuit (W-19). A block's key is its first slot's id.
  const slotById = new Map(slots.map((s) => [s.entry.id, s]));
  const units = workoutUnits(slots.map((s) => s.entry)).map((members) => {
    const ms = members.map((e) => slotById.get(e.id)!);
    return { key: ms[0].entry.id, members: ms, done: ms.every((m) => m.done), group: ms.length > 1 };
  });
  const unitOf = new Map(units.flatMap((u) => u.members.map((m) => [m.entry.id, u.key] as const)));
  // Exercises already done when the screen opens start folded (W-17).
  if (!doneAtOpen.current) doneAtOpen.current = new Set(units.filter((u) => u.done).map((u) => u.key));
  const newest = logs.reduce<SetLog | null>((a, l) => (!a || l.loggedAt > a.loggedAt ? l : a), null);
  const newestUnit = newest?.planExerciseId ? (unitOf.get(newest.planExerciseId) ?? null) : null;
  const isFolded = (key: string, done: boolean) => folded[key] ?? foldedByDefault(key, done, doneAtOpen.current!, newestUnit);
  // Moves count only the cards on screen, so ▲/▼ never swap with a hidden slot.
  const visible = slots.map((s) => s.entry);
  const move = (slotId: string, d: -1 | 1) => attempt(() => moveSlot(db, session.id, visible, slotId, d), setError);
  const setFold = (slotId: string, value: boolean) => setFolded((f) => ({ ...f, [slotId]: value }));

  // The card for one exercise or group (unchanged from before W-20 slice 7; moved here so "Now" can wrap it).
  const renderUnit = (u: (typeof units)[number], i: number) => {
        const id = u.key;
        if (u.group) {
          const groupControls: SlotControls = {
            moveUp: i > 0 ? () => move(id, -1) : undefined,
            moveDown: i < units.length - 1 ? () => move(id, 1) : undefined,
            onFold: u.done ? () => setFold(id, true) : undefined,
            onComplete: () => setFold(id, true),
          };
          const first = u.members[0].entry;
          const kind = first.groupKind ?? 'superset';
          const rounds = first.groupRounds ?? first.targetSets;
          if (isFolded(id, u.done)) {
            return (
              <button key={id} className="card folded-card" aria-expanded={false} onClick={() => setFold(id, false)}>
                <span className="done-tick" aria-hidden="true"><Icon name="check" size={14} strong /></span>
                <span className="folded-text">{`${groupLabel(kind)} · ${rounds} rounds · ${u.members.map((m) => m.ex.name).join(', ')}`}</span>
                <span className="fold-mark" aria-hidden="true">▾</span>
              </button>
            );
          }
          return (
            <GroupCard key={id} session={session} members={u.members} kind={kind} rounds={rounds} logs={logs} exercises={exercises} unit={unit} controls={groupControls} />
          );
        }
        const { entry, exId, ex, own, done } = u.members[0];
        if (isFolded(id, done)) {
          return (
            <button key={`${id}:${exId}`} className="card folded-card" aria-expanded={false} onClick={() => setFold(id, false)}>
              <span className="done-tick" aria-hidden="true"><Icon name="check" size={14} strong /></span>
              <span className="folded-text">{foldSummary(ex.name, ex.kind, own, unit)}</span>
              <span className="fold-mark" aria-hidden="true">▾</span>
            </button>
          );
        }
        const controls: SlotControls = {
          moveUp: i > 0 ? () => move(id, -1) : undefined,
          moveDown: i < units.length - 1 ? () => move(id, 1) : undefined,
          onFold: done ? () => setFold(id, true) : undefined,
          onComplete: () => setFold(id, true),
        };
        if (ex.kind === 'activity') {
          return (
            <ActivityCard
              key={`${id}:${exId}`}
              session={session}
              entry={entry}
              exercise={ex}
              original={exercises.get(entry.exerciseId)}
              log={own[0]}
              unit={unit}
              controls={controls}
            />
          );
        }
        return (
          <ExerciseCard
            key={`${id}:${exId}`}
            session={session}
            entry={entry}
            exercise={ex}
            original={exercises.get(entry.exerciseId)}
            logs={own}
            earlier={logs.filter((l) => l.planExerciseId === id && l.exerciseId !== exId)}
            exercises={exercises}
            unit={unit}
            controls={controls}
          />
        );
  };
  // The exercise being worked on now: the first one not yet done.
  const currentIndex = units.findIndex((u) => !(u.group ? u.done : u.members[0].done));

  return (
    <div className="screen log-screen">
      <Header title={session.planName} back={back} />
      <p className="subtitle">
        {timeLabel(session.time)} · {formatDate(session.date)}
      </p>
      {session.finishedAt !== null && (
        <div className="banner finished-banner">
          <span>Finished. Changes still save.</span>
          <button className="btn-secondary" onClick={() => attempt(() => reopenSession(db, session.id), setError)}>
            Reopen
          </button>
        </div>
      )}
      <WarmupCard session={session} />
      {entries.length === 0 && <p className="banner">This workout has no exercises.</p>}
      {units.map((u, i) => {
        // Same wrapper for every card, so a card never remounts when it stops being the current one.
        return (
          <div className={i === currentIndex ? 'log-unit log-current' : 'log-unit'} key={`unit:${u.key}`}>
            {renderUnit(u, i)}
          </div>
        );
      })}
      {orphans.length > 0 && (
        <section className="card">
          <div className="card-title">Also logged in this workout</div>
          <ul className="mini-list">
            {orphans
              .sort((a, b) => a.loggedAt - b.loggedAt)
              .map((l) => {
                const ex = exercises.get(l.exerciseId);
                return (
                  <li key={l.id}>
                    <span>{ex?.name ?? 'Unknown exercise'} · set {l.setNumber}</span>
                    <span className="muted">{ex ? partsText(l.parts, ex.kind, unit) : ''}</span>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
      <WorkoutNote key={session.id} sessionId={session.id} value={session.journalNote} />
      <ErrorText message={error} />
      {session.finishedAt === null && (
        <button
          className="btn-primary block finish"
          onClick={async () => {
            if (await attempt(() => finishSession(db, session.id), setError)) navigate('/today');
          }}
        >
          Finish workout
        </button>
      )}
    </div>
  );
}

// Rep change was removed in W-17: reps are changed by editing the set.
type Slot = { entry: PlanExercise; exId: string; ex: Exercise; own: SetLog[]; done: boolean };

/**
 * A superset or circuit in a workout (W-19): one card that goes round by round.
 * Each round lists every exercise with its pre-filled set, one tap each. Sets
 * are saved under their own exercise with the round as the set number. A
 * finished round stays in view so its sets can be rated with one tap; rating
 * its last set, or "Next round", moves on.
 */
function GroupCard(props: {
  session: Session;
  members: Slot[];
  kind: GroupKind;
  rounds: number;
  logs: SetLog[];
  exercises: Map<string, Exercise>;
  unit: Unit;
  controls: SlotControls;
}) {
  const { session, members, kind, rounds, logs, unit, controls } = props;
  const [picked, setPicked] = useState<number | null>(null);
  const [advanced, setAdvanced] = useState<Set<number>>(new Set());
  const setOf = (m: Slot, r: number) => m.own.find((l) => l.setNumber === r);
  const complete = (r: number) => members.every((m) => (m.ex.kind === 'activity' ? m.own.length > 0 : !!setOf(m, r)));
  const rated = (r: number) => members.every((m) => m.ex.kind === 'activity' || (setOf(m, r)?.difficulty ?? null) !== null);
  // A round counts as passed once a later round has a set logged, so coming back to the
  // screen (which forgets "Next round") never jumps back to an earlier round.
  const laterLogged = (r: number) => members.some((m) => m.own.some((l) => l.setNumber > r));
  let auto = rounds;
  for (let r = 1; r <= rounds; r++) {
    if (!(complete(r) && (rated(r) || advanced.has(r) || laterLogged(r)))) {
      auto = r;
      break;
    }
  }
  const shown = picked ?? auto;
  // The member whose set was logged last keeps its rating picker open; the others show their chip.
  const latest = members.reduce<{ id: string | null; at: number }>(
    (a, m) => m.own.reduce((b, l) => (l.loggedAt > b.at ? { id: m.entry.id, at: l.loggedAt } : b), a),
    { id: null, at: -1 },
  ).id;

  // Called after a rating is saved; the logs in props may not show it yet, so this round counts as rated
  // once every other member's set in it is rated.
  const onRated = (r: number, by: string) => {
    const othersRated = members.every((m) => m.entry.id === by || m.ex.kind === 'activity' || (setOf(m, r)?.difficulty ?? null) !== null);
    if (!complete(r) || !othersRated) return;
    if (r === rounds) controls.onComplete?.();
    else {
      setAdvanced((a) => new Set(a).add(r));
      if (picked === r) setPicked(null);
    }
  };

  return (
    <section className="card exercise-card group-card">
      <div className="group-head">
        <CardTitle name={`${groupLabel(kind)} · ${rounds} rounds`} controls={controls} />
        <div className="row-sub">{members.map((m, i) => `A${i + 1} ${m.ex.name}`).join(' · ')}</div>
      </div>
      <div className="round-chips" role="group" aria-label="Rounds">
        {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
          <button
            key={r}
            className={`${r === shown ? 'active' : ''}${complete(r) ? ' done' : ''}`}
            aria-pressed={r === shown}
            aria-label={`Round ${r}${complete(r) ? ', done' : ''}`}
            onClick={() => setPicked(r === auto ? null : r)}
          >
            {complete(r) ? <Icon name="check" size={18} strong /> : r}
          </button>
        ))}
      </div>
      <div className="round-title">
        <span>
          Round {shown} of {rounds}
        </span>
        {complete(shown) && shown < rounds && shown === auto && (
          <button className="btn-primary next-round" onClick={() => setAdvanced((a) => new Set(a).add(shown))}>
            Next round →
          </button>
        )}
      </div>
      {members.map((m, i) =>
        m.ex.kind === 'activity' ? (
          <ActivityCard key={`${m.entry.id}:${m.exId}`} session={session} entry={m.entry} exercise={m.ex} original={props.exercises.get(m.entry.exerciseId)} log={m.own[0]} unit={unit} />
        ) : (
          <ExerciseCard
            key={`${m.entry.id}:${m.exId}`}
            session={session}
            entry={m.entry}
            exercise={m.ex}
            original={props.exercises.get(m.entry.exerciseId)}
            logs={m.own}
            earlier={logs.filter((l) => l.planExerciseId === m.entry.id && l.exerciseId !== m.exId)}
            exercises={props.exercises}
            unit={unit}
            onlySet={shown}
            label={`A${i + 1}`}
            onRated={(n) => onRated(n, m.entry.id)}
            ratingOpen={latest === null || latest === m.entry.id}
          />
        ),
      )}
      <div className="card-foot">
        <MoveButtons name={groupLabel(kind)} controls={controls} />
      </div>
    </section>
  );
}

type Mode =
  | { kind: 'weight' | 'failed'; step: 'set' }
  | { kind: 'weight'; step: 'rep'; setNumber: number }
  | { kind: 'weight'; step: 'value'; setNumber: number; atRep: number }
  | { kind: 'failed'; step: 'value'; setNumber: number };

const MODE_LABEL = { weight: 'Weight change', failed: 'Failed' } as const;

function ExerciseCard(props: {
  session: Session;
  entry: PlanExercise;
  exercise: Exercise;
  original: Exercise | undefined;
  logs: SetLog[];
  earlier: SetLog[];
  exercises: Map<string, Exercise>;
  unit: Unit;
  controls?: SlotControls;
  /** Inside a superset/circuit (W-19): show only this set (the round), with a compact header. */
  onlySet?: number;
  /** Shown before the name inside a group, e.g. "A1". */
  label?: string;
  /** Called after a set's difficulty is picked (a group uses it to move to the next round). */
  onRated?: (setNumber: number) => void;
  /** In a group only the latest-logged exercise keeps its rating picker open, so the next set stays in view. */
  ratingOpen?: boolean;
}) {
  const { session, entry, exercise, logs, unit, controls, onlySet } = props;
  const compact = onlySet !== undefined;
  const [menu, setMenu] = useState(false);
  const kind = exercise.kind;
  const prefill = useLiveQuery(() => prefillFor(db, session.id, exercise.id, 30), [session.id, exercise.id]);
  const kept = cardDraftsFor(`${session.id}:${entry.id}:${exercise.id}`);
  const drafts = useRef(kept.drafts);
  const [, rerender] = useState(0);
  const [extra, setExtraState] = useState(kept.extra);
  const setExtra = (n: number) => {
    kept.extra = n;
    setExtraState(n);
  };
  const [mode, setMode] = useState<Mode | null>(null);
  const [rating, setRatingState] = useState<number | null>(null);
  /** The picker opened by itself after logging (not by a tap); in a group only the latest of those stays open. */
  const [ratingAuto, setRatingAuto] = useState(false);
  const setRating = (n: number | null, auto = false) => {
    setRatingState(n);
    setRatingAuto(auto);
  };
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byNumber = new Map(logs.map((l) => [l.setNumber, l]));
  const maxLogged = logs.reduce((m, l) => Math.max(m, l.setNumber), 0);
  const rows = Math.max(entry.targetSets, maxLogged) + extra;
  const swapped = exercise.id !== entry.exerciseId;
  const draftKey = (n: number) => `${exercise.id}:${n}`;

  /**
   * What a row holds now: the logged set, else the typed draft, else the
   * pre-fill from last time. With no history (first time) an untouched row
   * copies the set above it, so set 2 onward is still one tap.
   */
  const partsOf = (n: number): SetPart[] => {
    const log = byNumber.get(n);
    if (log) return log.parts;
    const d = drafts.current.get(draftKey(n));
    if (d) return [d];
    const p: Prefill | undefined = prefill?.[n - 1];
    if (p) return [{ weightLb: p.weightLb, reps: p.reps, seconds: p.seconds }];
    if (n > 1) {
      const above = partsOf(n - 1);
      return [{ ...above[0], reps: above[0].reps === null ? null : totalReps(above) }];
    }
    return [EMPTY];
  };

  const run = (fn: () => Promise<unknown>) => attempt(fn, setError);

  /** One ± tap on part i of a row: on a logged set it changes the saved value; on an unlogged row, the draft. */
  const stepRow = (n: number, change: (p: SetPart) => SetPart, i = 0) => {
    const log = byNumber.get(n);
    if (log) return run(() => adjustSet(db, log.id, change, i));
    return setRow(n, change(partsOf(n)[0]));
  };

  /**
   * Save new numbers for a row: straight to the database if logged, else into the draft.
   * With a part index only that part of a weight-changed set changes; without one the set becomes this one part.
   */
  const setRow = (n: number, part: SetPart, i?: number) => {
    const log = byNumber.get(n);
    if (log) return run(() => updateSetParts(db, log.id, i === undefined ? [part] : log.parts.map((p, j) => (j === i ? part : p))));
    drafts.current.set(draftKey(n), part);
    rerender((x) => x + 1);
    return Promise.resolve(true);
  };

  const log = async (n: number, parts = partsOf(n), extraFields: { toFailure?: boolean } = {}) => {
    const ok = await run(() =>
      logSet(db, { sessionId: session.id, exerciseId: exercise.id, planExerciseId: entry.id, setNumber: n, parts, ...extraFields }),
    );
    if (ok) {
      drafts.current.delete(draftKey(n));
      setRating(n, true);
    }
    return ok;
  };

  /** Apply a change from the three change buttons to set n (logging it if it wasn't). */
  const applyChange = async (n: number, parts: SetPart[], failed: boolean) => {
    const existing = byNumber.get(n);
    const ok = existing
      ? await run(async () => {
          await updateSetParts(db, existing.id, parts);
          if (failed) await setToFailure(db, existing.id, true);
        })
      : await log(n, parts, failed ? { toFailure: true } : {});
    if (ok) setMode(null);
  };

  const lastLine = (n: number) => {
    const p = prefill?.[n - 1];
    if (!p) return n === 1 && !prefill?.length ? `target ${formatTargets(entry, kind, unit)}` : '';
    const bits = [`last: ${partsText(p.last.parts, kind, unit)}`];
    if (p.last.difficulty !== null) bits.push(`${p.last.difficulty}/10`);
    if (p.last.toFailure) bits.push('to failure');
    return bits.join(' · ');
  };

  const repHint = entry.repMin === entry.repMax ? `${entry.repMin}` : `${entry.repMin}–${entry.repMax}`;

  return (
    <section className={compact ? 'group-member' : 'card exercise-card'}>
      <div className="ex-head" hidden={compact || undefined}>
        <div>
          <CardTitle name={exercise.name} controls={controls}>
            {swapped && <span className="tag">swapped for this workout</span>}
          </CardTitle>
          <div className="row-sub">{formatTargets(entry, kind, unit)}</div>
        </div>
        <div className="ex-actions">
          <button
            className="btn-secondary small-btn"
            onClick={() => navigate(`/exercises/${exercise.id}/history?back=${encodeURIComponent(`/log/${session.id}`)}`)}
          >
            History
          </button>
          <button className="btn-secondary small-btn" onClick={() => setSwapping(!swapping)} aria-expanded={swapping}>
            Swap
          </button>
        </div>
      </div>

      {swapping && (
        <SwapPanel
          session={session}
          entry={entry}
          current={exercise.id}
          original={props.original}
          onDone={() => setSwapping(false)}
        />
      )}

      {props.earlier.length > 0 && (
        <p className="small-print muted">
          Logged before the swap:{' '}
          {props.earlier
            .map((l) => {
              const ex = props.exercises.get(l.exerciseId);
              return `${ex?.name ?? '?'} set ${l.setNumber} (${ex ? partsText(l.parts, ex.kind, unit) : ''})`;
            })
            .join('; ')}
        </p>
      )}

      <ol className="set-list">
        {(compact
          ? // The round's set, plus any set logged beyond the rounds (e.g. before grouping) so it isn't hidden.
            [onlySet!, ...logs.map((l) => l.setNumber).filter((x) => x > entry.targetSets && x !== onlySet).sort((a, b) => a - b)]
          : Array.from({ length: rows }, (_, i) => i + 1)
        ).map((n) => {
          const logged = byNumber.get(n);
          const parts = partsOf(n);
          const part = parts[0];
          const picking = mode?.step === 'set';
          return (
            <li key={n} className={`set-row${logged ? ' logged' : ''}`}>
              <div className="set-line">
                {compact ? (
                  <>
                    {props.label && <span className="member-label">{props.label}</span>}
                    <span className="set-last member-name">
                      <span>
                        {exercise.name}
                        {swapped && <span className="tag">swapped</span>}
                      </span>
                      <span className="row-sub">
                        {lastLine(n) || formatTargets(entry, kind, unit)}
                        {logged?.toFailure && <span className="tag fail-tag">to failure</span>}
                      </span>
                    </span>
                    <button className="icon-btn more-btn" aria-expanded={menu} aria-label={`More for ${exercise.name}`} onClick={() => setMenu(!menu)}>
                      <Icon name="more" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="set-num" aria-label={`Set ${n}`}>{n}</span>
                    <span className="set-last">
                      {lastLine(n)}
                      {logged?.toFailure && <span className="tag fail-tag">to failure</span>}
                    </span>
                  </>
                )}
                {logged && (
                  <button className="icon-btn" aria-label={`Delete set ${n}`} onClick={() => run(() => deleteSet(db, logged.id))}>
                    <Icon name="bin" size={20} />
                  </button>
                )}
                <button
                  className={`check-btn${logged ? ' done' : ''}`}
                  aria-label={logged ? `Set ${n} logged` : `Log set ${n}`}
                  onClick={() => (logged ? setRating(n) : log(n))}
                >
                  <Icon name="check" strong />
                </button>
              </div>

              {parts.length > 1 && (
                <div className="parts-line">
                  <span>{partsText(parts, kind, unit)}</span>
                  <button
                    className="link"
                    onClick={() => setRow(n, { ...parts[0], reps: totalReps(parts) })}
                  >
                    Back to one weight
                  </button>
                </div>
              )}
              {parts.length > 1 ? (
                // A weight-changed set: each weight gets its own weight and reps, so a drop set
                // like 6 × 120 then 5 × 100 can be entered exactly (hotfix 0.8.1).
                parts.map((pt, i) => {
                  const of = `set ${n}, weight ${i + 1}`;
                  return (
                    <div className="set-steppers part-steppers" key={i}>
                      <Stepper
                        label={kind === 'bodyweight' ? `Added weight, ${of}` : `Weight, ${of}`}
                        unitLabel={kind === 'bodyweight' ? `+${unit}` : unit}
                        display={pt.weightLb === null ? '' : displayNumber(pt.weightLb, unit)}
                        placeholder={kind === 'bodyweight' ? '0' : '–'}
                        wide
                        onStep={(d) =>
                          stepRow(n, (p) => {
                            const w = stepWeight(p.weightLb, d, unit);
                            return { ...p, weightLb: kind === 'bodyweight' && w === 0 ? null : w };
                          }, i)
                        }
                        onCommit={(t) => {
                          const w = parseWeight(t, unit, pt.weightLb);
                          setRow(n, { ...pt, weightLb: kind === 'bodyweight' && w === 0 ? null : w }, i);
                        }}
                      />
                      <Stepper
                        label={`Reps, ${of}`}
                        unitLabel="reps"
                        display={pt.reps === null ? '' : String(pt.reps)}
                        onStep={(d) => stepRow(n, (p) => ({ ...p, reps: Math.max(1, (p.reps ?? 0) + d) }), i)}
                        onCommit={(t) => setRow(n, { ...pt, reps: wholeOrNull(t) }, i)}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="set-steppers">
                  {kind !== 'timed' && (
                    <Stepper
                      label={kind === 'bodyweight' ? `Added weight, set ${n}` : `Weight, set ${n}`}
                      unitLabel={kind === 'bodyweight' ? `+${unit}` : unit}
                      display={part.weightLb === null ? '' : displayNumber(part.weightLb, unit)}
                      placeholder={kind === 'bodyweight' ? '0' : '–'}
                      wide
                      onStep={(d) =>
                        stepRow(n, (p) => {
                          const w = stepWeight(p.weightLb, d, unit);
                          return { ...p, weightLb: kind === 'bodyweight' && w === 0 ? null : w };
                        })
                      }
                      onCommit={(t) => {
                        const w = parseWeight(t, unit, part.weightLb);
                        setRow(n, { ...part, weightLb: kind === 'bodyweight' && w === 0 ? null : w });
                      }}
                    />
                  )}
                  {kind === 'timed' ? (
                    <Stepper
                      label={`Seconds, set ${n}`}
                      unitLabel="s"
                      display={part.seconds === null ? '' : String(part.seconds)}
                      placeholder={repHint}
                      onStep={(d) => stepRow(n, (p) => ({ ...p, seconds: Math.max(5, (p.seconds ?? 0) + d * 5) }))}
                      onCommit={(t) => setRow(n, { ...part, seconds: wholeOrNull(t) })}
                    />
                  ) : (
                    <Stepper
                      label={`Reps, set ${n}`}
                      unitLabel="reps"
                      display={part.reps === null ? '' : String(part.reps)}
                      placeholder={repHint}
                      onStep={(d) => stepRow(n, (p) => ({ ...p, reps: Math.max(1, (p.reps ?? 0) + d) }))}
                      onCommit={(t) => setRow(n, { ...part, reps: wholeOrNull(t) })}
                    />
                  )}
                </div>
              )}

              {logged && (
                <Difficulty
                  value={logged.difficulty}
                  open={rating === n && (!ratingAuto || props.ratingOpen !== false)}
                  setNumber={n}
                  onOpen={() => setRating(n)}
                  onPick={async (d) => {
                    if (!(await run(() => setDifficulty(db, logged.id, d)))) return;
                    setRating(null);
                    props.onRated?.(n);
                    // Rating a set of a finished exercise folds it (W-17). It doesn't fold the moment
                    // the last set is logged, so this picker stays in view; logging a set in another
                    // exercise folds it too (foldedByDefault).
                    if (slotDone(entry, logs, kind)) controls?.onComplete?.();
                  }}
                />
              )}

              {picking && (
                <button
                  className="pick-overlay"
                  aria-label={`${MODE_LABEL[mode.kind]}: set ${n}`}
                  onClick={() => {
                    if (mode.kind === 'weight') {
                      if (totalReps(parts) < 1) return setError('Enter the reps for that set first.');
                      if (kind === 'weight' && parts[0].weightLb === null) return setError('Enter the weight for that set first.');
                      setMode({ kind: 'weight', step: 'rep', setNumber: n });
                    } else setMode({ kind: mode.kind, step: 'value', setNumber: n });
                    setError(null);
                  }}
                >
                  Set {n}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {compact && menu && (
        <div className="member-menu">
          <button className="btn-secondary" onClick={() => navigate(`/exercises/${exercise.id}/history?back=${encodeURIComponent(`/log/${session.id}`)}`)}>History</button>
          <button className="btn-secondary" aria-expanded={swapping} onClick={() => setSwapping(!swapping)}>Swap</button>
          {kind !== 'timed' && (
            <>
              <button
                className="btn-secondary"
                onClick={() => {
                  const parts = partsOf(onlySet!);
                  if (totalReps(parts) < 1) return setError('Enter the reps for that set first.');
                  if (kind === 'weight' && parts[0].weightLb === null) return setError('Enter the weight for that set first.');
                  setError(null);
                  setMenu(false);
                  setMode({ kind: 'weight', step: 'rep', setNumber: onlySet! });
                }}
              >
                Weight change
              </button>
              <button className="btn-secondary" onClick={() => { setError(null); setMenu(false); setMode({ kind: 'failed', step: 'value', setNumber: onlySet! }); }}>
                Failed
              </button>
            </>
          )}
        </div>
      )}
      {mode && mode.step !== 'set' && (
        <ChangePanel
          key={`${mode.kind}:${mode.step}:${mode.setNumber}`}
          mode={mode}
          parts={partsOf(mode.setNumber)}
          entry={entry}
          unit={unit}
          onRep={(atRep) => setMode({ kind: 'weight', step: 'value', setNumber: mode.setNumber, atRep })}
          onApply={(parts, failed) => applyChange(mode.setNumber, parts, failed)}
          onCancel={() => setMode(null)}
        />
      )}
      {mode?.step === 'set' && (
        <div className="change-panel">
          <div className="change-title">{MODE_LABEL[mode.kind]}: which set?</div>
          <button className="btn-secondary" onClick={() => setMode(null)}>Cancel</button>
        </div>
      )}

      {!compact && <div className="change-buttons">
        {kind !== 'timed' && (
          <>
            <button className={`btn-secondary${mode?.kind === 'weight' ? ' active' : ''}`} onClick={() => { setMode({ kind: 'weight', step: 'set' }); setError(null); }}>
              Weight change
            </button>
            <button className={`btn-secondary${mode?.kind === 'failed' ? ' active' : ''}`} onClick={() => { setMode({ kind: 'failed', step: 'set' }); setError(null); }}>
              Failed
            </button>
          </>
        )}
      </div>}
      {!compact && <div className="card-foot">
        <MoveButtons name={exercise.name} controls={controls} />
        <button className="btn-secondary add-set" onClick={() => setExtra(extra + 1)}>
          + Set
        </button>
      </div>}
      <ErrorText message={error} />
    </section>
  );
}

function wholeOrNull(text: string): number | null {
  const v = Number(text.trim());
  return Number.isInteger(v) && v > 0 ? v : null;
}

/** − value + with a typeable middle. The typed value is saved when the box loses focus or Enter is pressed. */
function Stepper(props: {
  label: string;
  unitLabel: string;
  display: string;
  placeholder?: string;
  wide?: boolean;
  onStep: (d: 1 | -1) => void;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(props.display);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(props.display);
  }, [props.display, focused]);
  return (
    <div className={`stepper-box${props.wide ? ' wide' : ''}`}>
      <button className="step-btn" aria-label={`${props.label} down`} onClick={() => props.onStep(-1)}>
        <Icon name="minus" size={20} strong />
      </button>
      <label className="step-value">
        <input
          inputMode="decimal"
          aria-label={props.label}
          value={text}
          placeholder={props.placeholder}
          onFocus={(e) => {
            setFocused(true);
            e.target.select();
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => {
            setFocused(false);
            const typed = e.target.value;
            if (typed !== props.display) props.onCommit(typed);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <span className="step-unit">{props.unitLabel}</span>
      </label>
      <button className="step-btn" aria-label={`${props.label} up`} onClick={() => props.onStep(1)}>
        <Icon name="plus" size={20} strong />
      </button>
    </div>
  );
}

/** 1–10 difficulty: two rows of five, one tap. Collapses to a chip once picked. */
function Difficulty(props: { value: number | null; open: boolean; setNumber: number; onOpen: () => void; onPick: (d: number | null) => void }) {
  if (!props.open) {
    return (
      <button className="diff-chip" onClick={props.onOpen} aria-label={`Difficulty for set ${props.setNumber}: ${props.value ?? 'not set'}. Change`}>
        {props.value === null ? 'Rate difficulty' : `Difficulty ${props.value}`}
      </button>
    );
  }
  return (
    <div className="diff-picker" role="group" aria-label={`Difficulty for set ${props.setNumber}, 1 easy to 10 couldn't do another rep`}>
      <div className="diff-grid">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => (
          <button key={d} className={props.value === d ? 'active' : ''} onClick={() => props.onPick(d)}>
            {d}
          </button>
        ))}
      </div>
      <div className="diff-foot muted">
        <span>1 easy · 10 couldn't do another</span>
        {props.value !== null && (
          <button className="link" onClick={() => props.onPick(null)}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function ChangePanel(props: {
  mode: Exclude<Mode, { step: 'set' }>;
  parts: SetPart[];
  entry: PlanExercise;
  unit: Unit;
  onRep: (atRep: number) => void;
  onApply: (parts: SetPart[], failed: boolean) => void;
  onCancel: () => void;
}) {
  const { mode, parts, entry, unit } = props;
  const [typed, setTyped] = useState('');
  const total = totalReps(parts);
  let body;
  if (mode.kind === 'weight' && mode.step === 'rep') {
    body = (
      <>
        <div className="change-title">Set {mode.setNumber}: at which rep did the weight change?</div>
        <div className="chips">
          {Array.from({ length: total }, (_, i) => i + 1).map((r) => (
            <button key={r} onClick={() => props.onRep(r)}>{r}</button>
          ))}
        </div>
      </>
    );
  } else if (mode.kind === 'weight' && mode.step === 'value') {
    // The weight in use at that rep is the base for the quick drops.
    let left = mode.atRep;
    const base = parts.find((p) => (left -= p.reps ?? 0) <= 0)?.weightLb ?? parts[parts.length - 1].weightLb ?? 0;
    const apply = (lb: number) => props.onApply(changeWeightAt(parts, mode.atRep, lb), false);
    body = (
      <>
        <div className="change-title">
          Set {mode.setNumber}, from rep {mode.atRep}: new weight
        </div>
        {base > 0 && <div className="chips drops">
          {[10, 20, 30].map((pct) => {
            const lb = quickDrop(base, pct, unit);
            return (
              <button key={pct} onClick={() => apply(lb)}>
                −{pct}% <small>{formatWeight(lb, unit)}</small>
              </button>
            );
          })}
        </div>}
        <div className="inline-form">
          <input inputMode="decimal" aria-label={`New weight in ${unit}`} placeholder={unit} value={typed} onChange={(e) => setTyped(e.target.value)} />
          <button
            className="btn-primary"
            onClick={() => {
              const lb = parseWeight(typed, unit, null);
              if (lb !== null) apply(lb);
            }}
          >
            Save
          </button>
        </div>
      </>
    );
  } else {
    // Failed: how many reps were reached before failing.
    const hi = Math.max(entry.repMax, total);
    const lo = Math.max(1, hi - 9);
    const apply = (reps: number) => props.onApply(setTotalReps(parts, reps), true);
    body = (
      <>
        <div className="change-title">
          Set {mode.setNumber}: how many reps before failing?{parts.length > 1 && ' (in total, all weights)'}
        </div>
        <div className="chips">
          {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((r) => (
            <button key={r} onClick={() => apply(r)}>{r}</button>
          ))}
        </div>
        <div className="inline-form">
          <input inputMode="numeric" aria-label="Reps" placeholder="reps" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <button
            className="btn-primary"
            onClick={() => {
              const r = wholeOrNull(typed);
              if (r) apply(r);
            }}
          >
            Save
          </button>
        </div>
      </>
    );
  }
  return (
    <div className="change-panel">
      {body}
      <button className="btn-secondary" onClick={props.onCancel}>Cancel</button>
    </div>
  );
}

export function SwapPanel(props: { session: Session; entry: PlanExercise; current: string; original: Exercise | undefined; onDone: () => void }) {
  const choices = useLiveQuery(() => swapChoices(db, props.entry, props.current), [props.entry.id, props.current]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pick = async (id: string) => {
    if (await attempt(() => swapForSession(db, props.session.id, props.entry, id), setError)) props.onDone();
  };
  const q = search.trim().toLowerCase();
  const others = (choices?.others ?? []).filter((e) => !q || e.name.toLowerCase().includes(q));
  return (
    <div className="swap-panel">
      <p className="small-print muted">For this workout only. The saved workout doesn't change.</p>
      {props.current !== props.entry.exerciseId && props.original && (
        <button className="row" onClick={() => pick(props.entry.exerciseId)}>
          <span className="row-main">Back to {props.original.name}</span>
        </button>
      )}
      {choices && choices.alternates.length > 0 && (
        <>
          <div className="group-title">Alternates</div>
          <ul className="list">
            {choices.alternates.map((e) => (
              <li key={e.id}>
                <button className="row" onClick={() => pick(e.id)}>
                  <span className="row-main">{e.name}</span>
                  <span className="row-sub">{e.muscleGroup} · {e.equipment}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="group-title">All exercises</div>
      <input className="search" placeholder="Search exercises" aria-label="Search exercises" value={search} onChange={(e) => setSearch(e.target.value)} />
      <ul className="list swap-list">
        {others.map((e) => (
          <li key={e.id}>
            <button className="row" onClick={() => pick(e.id)}>
              <span className="row-main">{e.name}</span>
              <span className="row-sub">{e.muscleGroup} · {e.equipment}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="btn-secondary block" onClick={props.onDone}>Cancel</button>
      <ErrorText message={error} />
    </div>
  );
}
