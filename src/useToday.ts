import { useEffect, useState } from 'react';
import { todayLocal } from './db/dates';

/** Today's date, kept current when the app comes back to the screen or the clock passes midnight. */
export function useToday(): string {
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
