import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { entriesFor, toShown } from '../db/body';
import { minutesExercised, planAdherence, weekPrCount, weekStreak, weeklyVolume } from '../db/home';
import { finishedWorkouts, weekRange } from '../db/stats';
import { getUnit, toDisplay, type Unit } from '../db/units';
import { MetricTile, SegmentBar, StatStrip } from '../ui/components';

/**
 * This week's numbers and trends (W-20, R-16.4), shared by Home and Progress
 * so both always show the same figures.
 */
export interface WeekNumbers {
  unit: Unit;
  week: { from: string; to: string };
  prs: number;
  done: number;
  minutes: number;
  streak: number;
  volume: { volumeLb: number; lastWeekLb: number; changePct: number | null };
  adherence: { done: number; scheduled: number } | null;
  bodyweight: { value: number; date: string } | null;
}

export function useWeekNumbers(today: string): WeekNumbers | undefined {
  return useLiveQuery(async () => {
    const week = await weekRange(db, today);
    return {
      unit: await getUnit(db),
      week,
      prs: await weekPrCount(db, today),
      done: await finishedWorkouts(db, week.from, week.to),
      minutes: await minutesExercised(db, today),
      streak: await weekStreak(db, today),
      volume: await weeklyVolume(db, today),
      adherence: await planAdherence(db, today),
      bodyweight: (await entriesFor(db, 'bodyweight'))[0] ?? null,
    };
  }, [today]);
}

/** Streak tile shows the last 8 weeks as segments. */
const STREAK_SEGMENTS = 8;

export const whole = (n: number) => Math.round(n).toLocaleString('en-US');
export const bodyweightText = (lb: number, unit: Unit) => String(Math.round(toShown('weight', lb, unit) * 10) / 10);

export type WeekTarget = 'records' | 'workouts' | 'trends';

export function WeekStrip({ d, onPick }: { d: WeekNumbers; onPick?: (t: WeekTarget) => void }) {
  const pick = (t: WeekTarget) => (onPick ? () => onPick(t) : undefined);
  return (
    <StatStrip
      label="This week"
      stats={[
        { value: d.prs, caption: d.prs === 1 ? 'new PR' : 'new PRs', onClick: pick('records') },
        { value: d.done, caption: d.done === 1 ? 'workout' : 'workouts', onClick: pick('workouts') },
        { value: whole(d.minutes), caption: 'minutes', onClick: pick('workouts') },
      ]}
    />
  );
}

export function TrendTiles({ d, today, onBodyweight, onTrend }: { d: WeekNumbers; today: string; onBodyweight: () => void; onTrend?: () => void }) {
  const { unit, volume: vol, adherence: adh, bodyweight: bw } = d;
  return (
    <div className="ui-tiles">
      <MetricTile
        label="Bodyweight"
        value={bw ? bodyweightText(bw.value, unit) : '—'}
        unit={bw ? unit : undefined}
        caption={bw?.date === today ? 'Today · tap to change' : 'Tap to add today'}
        onClick={onBodyweight}
      />
      <MetricTile label="Week streak" value={d.streak} unit={d.streak === 1 ? 'week' : 'weeks'} onClick={onTrend}>
        <SegmentBar total={STREAK_SEGMENTS} filled={d.streak} label={`${Math.min(d.streak, STREAK_SEGMENTS)} of the last ${STREAK_SEGMENTS} weeks`} />
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
        onClick={onTrend}
      />
      <MetricTile
        label="Adherence"
        value={adh ? adh.done : '—'}
        unit={adh ? `of ${adh.scheduled}` : undefined}
        caption={adh ? undefined : 'nothing scheduled this week'}
        onClick={onTrend}
      >
        {adh && <SegmentBar total={adh.scheduled} filled={adh.done} label={`${adh.done} of ${adh.scheduled} scheduled workouts done`} />}
      </MetricTile>
    </div>
  );
}
