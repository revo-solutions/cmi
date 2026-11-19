import type { Sex } from '../../api/generated/client';
import { getDatabase, useRows } from '../../lib/db';
import { enqueue, updatedAfter } from '../../lib/outbox';
import { changeAccount } from '../../lib/sync';

type ProfileRow = {
  name: string | null;
  sex: Sex;
  birth_date: string | null;
  conditions: string;
  other_condition: string | null;
  lives_alone: number | null;
  fell_last_year: number | null;
  vision_difficulty: number | null;
  updated_at: string | null;
};

// A null answer is one the person skipped. Conditions are the server's HealthCondition codes.
export type Profile = {
  name: string | null;
  sex: Sex;
  birthDate: string | null;
  conditions: string[];
  otherCondition: string | null;
  livesAlone: boolean | null;
  fellLastYear: boolean | null;
  visionDifficulty: boolean | null;
  updatedAt: string | null;
};

const profileSql = 'SELECT * FROM profile WHERE id = 1';

const empty: Profile = {
  name: null, sex: null, birthDate: null, conditions: [], otherCondition: null,
  livesAlone: null, fellLastYear: null, visionDifficulty: null, updatedAt: null,
};

function answer(value: number | null) {
  return value === null ? null : value === 1;
}

function toProfile(row: ProfileRow | undefined): Profile {
  if (!row) {
    return empty;
  }
  return {
    name: row.name,
    sex: row.sex,
    birthDate: row.birth_date,
    conditions: JSON.parse(row.conditions) as string[],
    otherCondition: row.other_condition,
    livesAlone: answer(row.lives_alone),
    fellLastYear: answer(row.fell_last_year),
    visionDifficulty: answer(row.vision_difficulty),
    updatedAt: row.updated_at,
  };
}

export function useProfile() {
  const rows = useRows<ProfileRow>(profileSql);
  return rows && toProfile(rows[0]);
}

export async function getProfile() {
  const db = await getDatabase();
  return toProfile(await db.getFirstAsync<ProfileRow>(profileSql) ?? undefined);
}

export function hasHealthAnswers(profile: Profile) {
  return profile.conditions.length > 0
    || profile.livesAlone !== null || profile.fellLastYear !== null || profile.visionDifficulty !== null;
}

// The profile syncs as a whole, so every change queues all of it.
export async function saveProfile(change: Partial<Omit<Profile, 'updatedAt'>>) {
  await changeAccount(async (transaction) => {
    const current = toProfile(await transaction.getFirstAsync<ProfileRow>(profileSql) ?? undefined);
    const next = { ...current, ...change, updatedAt: updatedAfter(current.updatedAt) };
    await transaction.runAsync(`
      INSERT INTO profile (id, name, sex, birth_date, conditions, other_condition, lives_alone, fell_last_year,
        vision_difficulty, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET name = excluded.name, sex = excluded.sex, birth_date = excluded.birth_date,
        conditions = excluded.conditions, other_condition = excluded.other_condition,
        lives_alone = excluded.lives_alone, fell_last_year = excluded.fell_last_year,
        vision_difficulty = excluded.vision_difficulty, updated_at = excluded.updated_at
    `, next.name, next.sex, next.birthDate, JSON.stringify(next.conditions), next.otherCondition, next.livesAlone,
    next.fellLastYear, next.visionDifficulty, next.updatedAt);
    await enqueue(transaction, 'profile', next);
  });
}
