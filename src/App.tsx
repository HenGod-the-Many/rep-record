import { useEffect, useState } from 'react';
import { useRoute, navigate } from './router';
import { ExerciseList } from './screens/ExerciseList';
import { ExerciseForm } from './screens/ExerciseForm';
import { PlanList } from './screens/PlanList';
import { PlanDetail } from './screens/PlanDetail';
import { EntryEdit } from './screens/EntryEdit';
import { ExercisePicker } from './screens/ExercisePicker';
import { DayView } from './screens/DayView';
import { MoveDay } from './screens/MoveDay';
import { Calendar } from './screens/Calendar';
import { SplitEdit, SplitList } from './screens/Splits';
import { Settings } from './screens/Settings';
import { LogWorkout } from './screens/LogWorkout';
import { todayLocal } from './db/dates';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date, kept current when the app comes back to the screen or the clock passes midnight. */
function useToday(): string {
  const [today, setToday] = useState(todayLocal);
  useEffect(() => {
    const check = () => setToday(todayLocal());
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return today;
}

function Screen() {
  const { parts, query } = useRoute();
  const [section, id, sub, subId] = parts;
  const back = query.get('back') ?? undefined;
  const today = useToday();

  if (section === 'exercises' && id) return <ExerciseForm id={id === 'new' ? null : id} />;
  if (section === 'exercises') return <ExerciseList />;
  if (section === 'plans' && id && sub === 'entry' && subId) return <EntryEdit planId={id} entryId={subId} />;
  if (section === 'plans' && id) return <PlanDetail planId={id} />;
  if (section === 'plans') return <PlanList />;
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
  if (section === 'log' && id) return <LogWorkout sessionId={id} />;
  return <DayView key={today} date={today} isToday />;
}

const TABS: { key: string; label: string; path: string; sections: string[] }[] = [
  { key: 'today', label: 'Today', path: '/today', sections: ['today', 'settings', 'log', ''] },
  { key: 'calendar', label: 'Calendar', path: '/calendar', sections: ['calendar', 'day', 'move'] },
  { key: 'splits', label: 'Splits', path: '/splits', sections: ['splits'] },
  { key: 'plans', label: 'Plans', path: '/plans', sections: ['plans', 'pick'] },
  { key: 'exercises', label: 'Exercises', path: '/exercises', sections: ['exercises'] },
];

export function App() {
  const { parts } = useRoute();
  const section = parts[0] ?? '';
  const active = TABS.find((t) => t.sections.includes(section))?.key ?? 'today';
  return (
    <div className="app">
      <main className="content">
        <Screen key={parts.join('/')} />
      </main>
      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.key} className={active === t.key ? 'active' : ''} onClick={() => navigate(t.path)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
