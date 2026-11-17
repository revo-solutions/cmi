import { createContext, useContext } from 'react';

import { setSetting, useRows } from '../../lib/db';
import { localDate } from '../medications/doses';
import { hasHealthAnswers, type Profile } from '../profile/store';

// The trusted contact joins between medications and permissions with phase 5 (docs/plano-app.md).
export const setupSteps = ['about', 'health', 'medications', 'permissions'] as const;

export type SetupStep = (typeof setupSteps)[number] | 'done';

// A skipped health questionnaire is asked again on Hoje this many days later (docs/escopo.md).
export const healthAskAgainDays = 3;

// Kept per account on this phone: setup resumes where it stopped, and another account starts its own.
const stepKey = (accountId: string) => `setup_step.${accountId}`;
const healthAskedKey = (accountId: string) => `health_asked.${accountId}`;

export function useStoredSetupStep(accountId: string) {
  const rows = useRows<{ value: SetupStep }>('SELECT value FROM settings WHERE key = ?', [stepKey(accountId)]);
  return rows && (rows[0]?.value ?? null);
}

// An account restored with a profile was set up on another phone; this one still needs the permissions.
export function firstSetupStep(profile: Profile): SetupStep {
  return profile.updatedAt ? 'permissions' : 'about';
}

export function saveSetupStep(accountId: string, step: SetupStep) {
  return setSetting(stepKey(accountId), step);
}

export function askHealthLater(accountId: string, today = localDate(new Date())) {
  return setSetting(healthAskedKey(accountId), today);
}

export function useHealthAskedOn(accountId: string) {
  const rows = useRows<{ value: string }>('SELECT value FROM settings WHERE key = ?', [healthAskedKey(accountId)]);
  return rows && (rows[0]?.value ?? null);
}

export function isHealthCardDue(profile: Profile, askedOn: string | null, today: string) {
  if (!askedOn || hasHealthAnswers(profile)) {
    return false;
  }
  return Date.parse(today) - Date.parse(askedOn) >= healthAskAgainDays * 86_400_000;
}

export const SetupContext = createContext<{ step: SetupStep; setStep: (step: SetupStep) => void }>({
  step: 'done',
  setStep: () => {},
});

export function useSetup() {
  return useContext(SetupContext);
}

export function useNeedsSetup() {
  return useSetup().step !== 'done';
}

export function useSetupDone() {
  return useSetup().step === 'done';
}
