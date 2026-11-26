import { useState } from 'react';
import { HeroCard, LargeTitle, ListRow, MainAction, MetricTile, MoreMenu, SecondaryButton, SegmentBar, SegmentedSwitch, StatStrip, TextButton, IconButton } from './components';
import { Icon, ICON_NAMES } from './icons';

/** Dev-only page (#/ui) showing every Plate component, for screenshots and review. Not in the production app. */
export function Gallery() {
  const [tab, setTab] = useState<'programs' | 'workouts' | 'exercises' | 'warmups'>('programs');
  const noop = () => undefined;
  return (
    <div className="screen">
      <LargeTitle context="Wednesday 25 November" title="Components" action={<IconButton icon="gear" label="Settings" onClick={noop} />} />
      <HeroCard context="Today · Upper A" name="Push day" facts="6 exercises · about 55 min">
        <MainAction onClick={noop}>Start workout</MainAction>
      </HeroCard>
      <StatStrip label="This week" stats={[{ value: 3, caption: 'New PRs', onClick: noop }, { value: 4, caption: 'Workouts', onClick: noop }, { value: 212, caption: 'Minutes', onClick: noop }]} />
      <h2 className="ui-section-label">Trends</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
        <MetricTile label="Bodyweight" value="182.4" unit="lb" caption="Tap to add today" onClick={noop} />
        <MetricTile label="Week streak" value={6} unit="weeks"><SegmentBar total={8} filled={6} label="6 of the last 8 weeks" /></MetricTile>
        <MetricTile label="Volume" value="38.2k" unit="lb" caption="+8% on last week" />
        <MetricTile label="Adherence" value="3/4" caption="workouts done"><SegmentBar total={4} filled={3} label="3 of 4 done" /></MetricTile>
      </div>
      <SegmentedSwitch label="Library" value={tab} onChange={setTab} options={[{ value: 'programs', label: 'Programs' }, { value: 'workouts', label: 'Workouts' }, { value: 'exercises', label: 'Exercises' }, { value: 'warmups', label: 'Warm-ups' }]} />
      <ListRow title="Bench press" caption="Chest · barbell" onClick={noop} />
      <ListRow title="Best set" value="225 × 5" />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '16px 0' }}>
        <SecondaryButton icon="plus" onClick={noop}>Add exercise</SecondaryButton>
        <TextButton onClick={noop}>Edit</TextButton>
        <TextButton danger onClick={noop}>Remove</TextButton>
        <MoreMenu label="More actions" items={[{ label: 'Move day', onSelect: noop }, { label: 'Replace', onSelect: noop }, { label: 'Clear day', onSelect: noop, danger: true }]} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, color: 'var(--ink)' }}>
        {ICON_NAMES.map((n) => (
          <span key={n} title={n}><Icon name={n} /></span>
        ))}
      </div>
    </div>
  );
}
