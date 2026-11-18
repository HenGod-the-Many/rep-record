import { useRoute, navigate } from './router';
import { ExerciseList } from './screens/ExerciseList';
import { ExerciseForm } from './screens/ExerciseForm';
import { PlanList } from './screens/PlanList';
import { PlanDetail } from './screens/PlanDetail';
import { EntryEdit } from './screens/EntryEdit';
import { ExercisePicker } from './screens/ExercisePicker';

function Screen() {
  const { parts, query } = useRoute();
  const [section, id, sub, subId] = parts;

  if (section === 'exercises' && id) return <ExerciseForm id={id === 'new' ? null : id} />;
  if (section === 'plans' && id && sub === 'entry' && subId) return <EntryEdit planId={id} entryId={subId} />;
  if (section === 'plans' && id) return <PlanDetail planId={id} />;
  if (section === 'plans') return <PlanList />;
  if (section === 'pick') return <ExercisePicker query={query} />;
  return <ExerciseList />;
}

export function App() {
  const { parts } = useRoute();
  const section = parts[0] === 'plans' || parts[0] === 'pick' ? 'plans' : 'exercises';
  return (
    <div className="app">
      <main className="content">
        <Screen key={parts.join('/')} />
      </main>
      <nav className="tabbar" aria-label="Sections">
        <button className={section === 'exercises' ? 'active' : ''} onClick={() => navigate('/exercises')}>
          Exercises
        </button>
        <button className={section === 'plans' ? 'active' : ''} onClick={() => navigate('/plans')}>
          Plans
        </button>
      </nav>
    </div>
  );
}
