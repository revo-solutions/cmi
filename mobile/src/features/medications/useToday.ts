import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { dosesOn, localDate } from './doses';
import { useDoseRecords, useMedications, usePeriods } from './store';

// The clock the screens read, moved every minute and on coming back to the app, so a dose turns "Sem confirmação"
// without a restart.
export function useNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(new Date());
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return now;
}

// A day's doses with their states; undefined while the database loads.
export function useDoses(date: string, now: Date) {
  const medications = useMedications();
  const periods = usePeriods();
  const records = useDoseRecords(date);

  if (!medications || !periods || !records) {
    return { medications, doses: undefined };
  }

  return { medications, doses: dosesOn(date, medications, periods, records, now) };
}

export function useToday() {
  const now = useNow();
  const date = localDate(now);
  return { now, date, ...useDoses(date, now) };
}
