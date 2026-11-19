import type { Relationship, Sex } from '../../api/generated/client';

export const sexOptions: { value: NonNullable<Sex>; label: string }[] = [
  { value: 'Male', label: 'Homem' },
  { value: 'Female', label: 'Mulher' },
];

// The app writes to the person in their gender, never in a neutral form (docs/escopo.md). Only a profile made before
// the question has no sex, and Hoje asks it until answered.
export function bySex(sex: Sex, male: string, female: string) {
  return sex === 'Female' ? female : male;
}

const female: Relationship[] = ['Mother', 'Wife', 'Grandmother', 'Aunt'];
const male: Relationship[] = ['Father', 'Husband', 'Grandfather', 'Uncle'];

// The relationships that fit the person, plus the current one so an older choice still shows.
export function relationshipsFor(sex: Sex, current: Relationship | null) {
  const own = sex === 'Female' ? female : sex === 'Male' ? male : [...female, ...male];
  const options: Relationship[] = [...own, 'Friend', 'Other'];
  return current && !options.includes(current) ? [...options, current] : options;
}
