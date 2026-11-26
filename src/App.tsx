import { useEffect } from 'react';
import { useRoute, navigate } from './router';
import { ExerciseList } from './screens/ExerciseList';
import { ExerciseForm } from './screens/ExerciseForm';
import { PlanList } from './screens/PlanList';
import { PlanDetail } from './screens/PlanDetail';
import { EntryEdit } from './screens/EntryEdit';
import { ExercisePicker } from './screens/ExercisePicker';
import { DayView } from './screens/DayView';
import { Home } from './screens/Home';
import { MoveDay } from './screens/MoveDay';
import { Calendar } from './screens/Calendar';
import { SplitEdit, SplitList } from './screens/Splits';
import { Settings } from './screens/Settings';
import { LogWorkout } from './screens/LogWorkout';
import { History } from './screens/History';
import { WarmupEdit, WarmupList } from './screens/Warmups';
import { BodyList, MetricPage, PhotosPage } from './screens/Body';
import { useToday } from './useToday';
import { applyUpdate, useUpdateReady } from './pwa';
import { Gallery } from './ui/Gallery';
import { Icon } from './ui/icons';
import { TABS, tabFor, tabPath } from './tabs';
import { lastLibraryPath } from './screens/Library';

const DATE = /^\d{4}-\d{2}-\d{2}$/;


/** #/library opens the part of the Library used last. */
function LibraryRedirect() {
  useEffect(() => navigate(lastLibraryPath(), { replace: true }), []);
  return null;
}

function Screen() {
  const { parts, query } = useRoute();
  const [section, id, sub, subId] = parts;
  const back = query.get('back') ?? undefined;
  const today = useToday();

  if (section === 'exercises' && id && sub === 'history') return <History exerciseId={id} back={back?.startsWith('/') ? back : '/exercises'} />;
  if (section === 'exercises' && id) return <ExerciseForm id={id === 'new' ? null : id} back={back?.startsWith('/') ? back : '/exercises'} />;
  if (section === 'exercises') return <ExerciseList />;
  if (section === 'plans' && id && sub === 'entry' && subId) return <EntryEdit planId={id} entryId={subId} />;
  if (section === 'plans' && id) return <PlanDetail planId={id} backTo={back?.startsWith('/') ? back : undefined} />;
  if (section === 'plans') return <PlanList />;
  if (section === 'warmups' && id) return <WarmupEdit warmupId={id} />;
  if (section === 'warmups') return <WarmupList />;
  if (section === 'library') return <LibraryRedirect />;
  if (section === 'pick') return <ExercisePicker query={query} />;
  if (section === 'splits' && id) return <SplitEdit splitId={id} />;
  if (section === 'splits') return <SplitList />;
  if (section === 'calendar') {
    const m = query.get('m');
    return <Calendar month={m && /^\d{4}-\d{2}$/.test(m) ? m : today.slice(0, 7)} />;
  }
  if (section === 'day' && id && DATE.test(id)) return <DayView date={id} back={back ?? `/calendar?m=${id.slice(0, 7)}`} />;
  if (section === 'move' && id && DATE.test(id)) return <MoveDay date={id} back={back ?? `/day/${id}`} />;
  if (section === 'settings') return <Settings />;
  if (section === 'body' && id === 'photos') return <PhotosPage />;
  if (section === 'body' && id) return <MetricPage metricId={id} />;
  if (section === 'body') return <BodyList focus={query.get('focus')} />;
  if (import.meta.env.DEV && section === 'ui') return <Gallery />;
  if (section === 'log' && id) return <LogWorkout key={id} sessionId={id} />;
  return <Home key={today} today={today} />;
}

export function App() {
  const { parts, query } = useRoute();
  const active = tabFor(parts, query);
  const updateReady = useUpdateReady();
  return (
    <div className="app">
      {updateReady && (
        <div className="update-bar" role="status">
          <span>A new version of Rep Record is ready.</span>
          <button className="btn-primary" onClick={applyUpdate}>Update</button>
        </div>
      )}
      <main className="content">
        <Screen key={parts.join('/')} />
      </main>
      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={active === t.key ? 'active' : ''}
            aria-current={active === t.key ? 'page' : undefined}
            onClick={() => navigate(tabPath(t.key, lastLibraryPath()))}
          >
            <Icon name={t.icon} strong={active === t.key} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
