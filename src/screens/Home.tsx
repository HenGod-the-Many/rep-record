import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatDate, timeLabel } from '../db/dates';
import { findSession, startOrResume } from '../db/logging';
import { getEntries } from '../db/plans';
import { resolveDate } from '../db/schedule';
import { finishedWorkouts, weekRange } from '../db/stats';
import { minutesExercised, planAdherence, weekPrCount, weekStreak, weeklyVolume } from '../db/home';
import { entriesFor, entryOn, parseShown, saveEntry, toShown } from '../db/body';
import { getUnit, toDisplay } from '../db/units';
import { navigate } from '../router';
import { HeroCard, IconButton, LargeTitle, ListRow, MainAction, MetricTile, SecondaryButton, SegmentBar, StatStrip, TextButton } from '../ui/components';
import { attempt, ErrorText } from './common';
import { BackupReminder } from './DayView';
import { DayNoteSection } from './Journal';
import { UndoBar } from './pickers';

/** Streak tile shows the last 8 weeks as segments. */
const STREAK_SEGMENTS = 8;

const whole = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * Home (W-20, R-16.4): today's workout with Start, this week's numbers, trends,
 * the day note and the backup reminder. Settings sit behind the gear. Changes
 * to today (add, replace, move, clear) are on today's day screen ("Edit today").
 */
export function Home({ today }: { today: string }) {
  const data = useLiveQuery(async () => {
    const day = await resolveDate(db, today);
    const workouts = await Promise.all(
      day.workouts.map(async (w) => {
        const plannedTimes = day.workouts.filter((x) => x.planId === w.planId).map((x) => x.time);
        const session = await findSession(db, { date: today, planId: w.planId, time: w.time, plannedTimes });
        return {
          ...w,
          plannedTimes,
          session,
          setCount: session ? await db.setLogs.where('sessionId').equals(session.id).count() : 0,
          plan: await db.plans.get(w.planId),
          exerciseCount: (await getEntries(db, w.planId)).length,
        };
      }),
    );
    const week = await weekRange(db, today);
    return {
      day,
      workouts,
      unit: await getUnit(db),
      prs: await weekPrCount(db, today),
      done: await finishedWorkouts(db, week.from, week.to),
      minutes: await minutesExercised(db, today),
      streak: await weekStreak(db, today),
      volume: await weeklyVolume(db, today),
      adherence: await planAdherence(db, today),
      bodyweight: (await entriesFor(db, 'bodyweight'))[0] ?? null,
    };
  }, [today]);
  const [error, setError] = useState<string | null>(null);
  const [addingWeight, setAddingWeight] = useState(false);
  const [weightText, setWeightText] = useState('');

  const gear = <IconButton icon="gear" label="Settings" onClick={() => navigate('/settings')} />;
  const title = <LargeTitle context={formatDate(today)} title="Today" action={gear} />;
  if (!data) return <div className="screen">{title}</div>;
  const { day, workouts, unit } = data;
  const editToday = () => navigate(`/day/${today}?back=${encodeURIComponent('/today')}`);
  const toProgress = () => navigate('/body');

  const next = workouts.find((w) => !(w.session && w.session.finishedAt !== null));
  const others = workouts.filter((w) => w !== next);

  const start = async (w: (typeof workouts)[number]) => {
    if (w.session) return navigate(`/log/${w.session.id}`);
    let id = '';
    if (await attempt(async () => { id = await startOrResume(db, { date: today, planId: w.planId, time: w.time, plannedTimes: w.plannedTimes }); }, setError)) {
      navigate(`/log/${id}`);
    }
  };

  // Opens straight from the tap (no waiting), so iPhone shows the keyboard for the focused box.
  const openWeight = () => {
    const e = data.bodyweight?.date === today ? data.bodyweight : null;
    setWeightText(e ? String(Math.round(toShown('weight', e.value, unit) * 10) / 10) : '');
    setAddingWeight(true);
  };
  const saveWeight = async () => {
    const current = (await entryOn(db, 'bodyweight', today))?.value ?? null;
    const ok = await attempt(() => saveEntry(db, 'bodyweight', today, parseShown('weight', weightText, unit, current)), setError);
    if (ok) setAddingWeight(false);
  };

  const bw = data.bodyweight;
  const vol = data.volume;
  const adh = data.adherence;

  return (
    <div className="screen">
      {title}
      <BackupReminder />
      <UndoBar />

      {next ? (
        <HeroCard
          context={`${timeLabel(next.time)}${workouts.length > 1 ? ` · ${workouts.indexOf(next) + 1} of ${workouts.length}` : ''}`}
          name={next.plan?.name ?? 'Deleted workout'}
          facts={next.session ? `${next.setCount} ${next.setCount === 1 ? 'set' : 'sets'} logged` : `${next.exerciseCount} ${next.exerciseCount === 1 ? 'exercise' : 'exercises'}`}
        >
          <MainAction onClick={() => start(next)} disabled={!next.plan}>
            {next.session ? 'Resume workout' : 'Start workout'}
          </MainAction>
        </HeroCard>
      ) : (
        <HeroCard
          context={workouts.length ? 'All done today' : day.scheduled || day.overridden ? 'Rest day' : 'Nothing planned'}
          name={workouts.length ? 'Nice work' : day.scheduled || day.overridden ? 'Rest' : 'Free day'}
          facts={workouts.length ? `${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'} finished` : 'Add a workout if you want one.'}
        />
      )}
      {others.length > 0 && (
        <div className="home-others">
          {others.map((w, i) => (
            <ListRow
              key={`${w.planId}-${i}`}
              title={w.plan?.name ?? 'Deleted workout'}
              caption={w.session?.finishedAt ? `Done · ${w.setCount} ${w.setCount === 1 ? 'set' : 'sets'}` : timeLabel(w.time)}
              onClick={w.session ? () => navigate(`/log/${w.session!.id}`) : editToday}
            />
          ))}
        </div>
      )}
      <div className="home-edit">
        <SecondaryButton icon="calendar" onClick={editToday}>Edit today</SecondaryButton>
      </div>
      <ErrorText message={error} />

      <StatStrip
        label="This week"
        stats={[
          { value: data.prs, caption: data.prs === 1 ? 'new PR' : 'new PRs', onClick: toProgress },
          { value: data.done, caption: data.done === 1 ? 'workout' : 'workouts', onClick: toProgress },
          { value: whole(data.minutes), caption: 'minutes', onClick: toProgress },
        ]}
      />

      <h2 className="ui-section-label">Trends</h2>
      <div className="ui-tiles">
        <MetricTile
          label="Bodyweight"
          value={bw ? String(Math.round(toShown('weight', bw.value, unit) * 10) / 10) : '—'}
          unit={bw ? unit : undefined}
          caption={bw?.date === today ? 'Today · tap to change' : 'Tap to add today'}
          onClick={openWeight}
        />
        <MetricTile label="Week streak" value={data.streak} unit={data.streak === 1 ? 'week' : 'weeks'} onClick={toProgress}>
          <SegmentBar total={STREAK_SEGMENTS} filled={data.streak} label={`${Math.min(data.streak, STREAK_SEGMENTS)} of the last ${STREAK_SEGMENTS} weeks`} />
        </MetricTile>
        <MetricTile
          label="Weekly volume"
          value={whole(toDisplay(vol.volumeLb, unit))}
          unit={unit}
          caption={
            vol.changePct === null ? 'nothing last week to compare' : (
              <span className={vol.changePct > 0 ? 'ui-good' : undefined}>
                {vol.changePct > 0 ? '▲ +' : vol.changePct < 0 ? '▼ ' : ''}
                {vol.changePct}% on last week
              </span>
            )
          }
          onClick={toProgress}
        />
        <MetricTile
          label="Plan adherence"
          value={adh ? adh.done : '—'}
          unit={adh ? `of ${adh.scheduled}` : undefined}
          caption={adh ? undefined : 'nothing scheduled this week'}
          onClick={toProgress}
        >
          {adh && <SegmentBar total={adh.scheduled} filled={adh.done} label={`${adh.done} of ${adh.scheduled} scheduled workouts done`} />}
        </MetricTile>
      </div>

      {addingWeight && (
        <div className="card home-weight">
          <label className="field">
            <span>Bodyweight today ({unit})</span>
            <input inputMode="decimal" autoFocus value={weightText} onChange={(e) => setWeightText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveWeight()} />
          </label>
          <div className="button-row two">
            <button className="btn-secondary" onClick={saveWeight}>Save</button>
            <TextButton onClick={() => setAddingWeight(false)}>Cancel</TextButton>
          </div>
        </div>
      )}

      <DayNoteSection date={today} />
    </div>
  );
}
