// "Bom dia, Maria", by the phone's clock; just "Bom dia" while the profile has no name.
export function greeting(now: Date, name: string | null) {
  const hour = now.getHours();
  const period = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
  const trimmed = name?.trim();
  return trimmed ? `${period}, ${trimmed}` : period;
}
