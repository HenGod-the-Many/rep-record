import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatDate, timeLabel } from '../db/dates';
import { findSession, startOrResume } from '../db/logging';
import { getEntries } from '../db/plans';
import { aboutMinutes, averageFor, workoutAverages } from '../db/averages';
import { resolveDate } from '../db/schedule';
import { entryOn, parseShown, saveEntry } from '../db/body';
import { navigate } from '../router';
import { HeroCard, IconButton, LargeTitle, ListRow, MainAction, SecondaryButton, TextButton } from '../ui/components';
import { attempt, ErrorText } from './common';
import { BackupReminder } from './DayView';
import { DayNoteSection } from './Journal';
import { UndoBar } from './pickers';
import { bodyweightText, TrendTiles, useWeekNumbers, WeekStrip, type WeekTarget } from './WeekNumbers';

/**
 * Home (W-20, R-16.4): today's workout with Start, this week's numbers, trends,
 * the day note and the backup reminder. Settings sit behind the gear. Changes
 * to today (add, replace, move, clear) are on today's day screen ("Edit today").
 * Tapping a number or trend opens its detail in Progress.
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
    return { day, workouts, averages: await workoutAverages(db, today) };
  }, [today]);
  const week = useWeekNumbers(today);
  const [error, setError] = useState<string | null>(null);
  const [addingWeight, setAddingWeight] = useState(false);
  const [weightText, setWeightText] = useState('');

  const gear = <IconButton icon="gear" label="Settings" onClick={() => navigate('/settings')} />;
  const title = <LargeTitle context={formatDate(today)} title="Today" action={gear} />;
  if (!data || !week) return <div className="screen">{title}</div>;
  const { day, workouts, averages } = data;
  const { unit } = week;
  const editToday = () => navigate(`/day/${today}?back=${encodeURIComponent('/today')}`);
  const toProgress = (t: WeekTarget) => navigate(`/body?focus=${t}`);

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
    const e = week.bodyweight?.date === today ? week.bodyweight : null;
    setWeightText(e ? bodyweightText(e.value, unit) : '');
    setAddingWeight(true);
  };
  const saveWeight = async () => {
    const current = (await entryOn(db, 'bodyweight', today))?.value ?? null;
    const ok = await attempt(() => saveEntry(db, 'bodyweight', today, parseShown('weight', weightText, unit, current)), setError);
    if (ok) setAddingWeight(false);
  };

  return (
    <div className="screen">
      {title}
      <BackupReminder />
      <UndoBar />

      {next ? (
        <HeroCard
          context={`${timeLabel(next.time)}${workouts.length > 1 ? ` · ${workouts.indexOf(next) + 1} of ${workouts.length}` : ''}`}
          name={next.plan?.name ?? 'Deleted workout'}
          facts={[
            next.session ? `${next.setCount} ${next.setCount === 1 ? 'set' : 'sets'} logged` : `${next.exerciseCount} ${next.exerciseCount === 1 ? 'exercise' : 'exercises'}`,
            averageFor(averages, next.plan) !== undefined ? aboutMinutes(averageFor(averages, next.plan)!) : null,
          ].filter(Boolean).join(' · ')}
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

      <WeekStrip d={week} onPick={toProgress} />

      <h2 className="ui-section-label">Trends</h2>
      <TrendTiles d={week} today={today} onBodyweight={openWeight} onTrend={() => toProgress('trends')} />

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
