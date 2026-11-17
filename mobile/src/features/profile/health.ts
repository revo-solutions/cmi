// The server's HealthCondition codes; the labels exist only in the app (AGENTS.md, "Product rules").
export const otherCondition = 'outra';
export const noCondition = 'nenhuma';

export const healthConditions: { code: string; label: string }[] = [
  { code: 'hipertensao', label: 'Pressão alta' },
  { code: 'diabetes', label: 'Diabetes' },
  { code: 'colesterol', label: 'Colesterol alto' },
  { code: 'coracao', label: 'Problema no coração' },
  { code: 'artrose_artrite', label: 'Artrose ou artrite' },
  { code: 'osteoporose', label: 'Osteoporose' },
  { code: 'tireoide', label: 'Tireoide' },
  { code: 'depressao_ansiedade', label: 'Depressão ou ansiedade' },
  { code: 'memoria', label: 'Problema de memória' },
  { code: 'asma_bronquite', label: 'Asma ou bronquite' },
  { code: 'avc', label: 'Já tive AVC (derrame)' },
  { code: 'rins', label: 'Problema nos rins' },
  { code: otherCondition, label: 'Outra' },
  { code: noCondition, label: 'Nenhuma' },
];

// "Nenhuma" can't be combined with any other answer, as the server checks.
export function toggleCondition(conditions: string[], code: string) {
  if (conditions.includes(code)) {
    return conditions.filter((c) => c !== code);
  }
  return code === noCondition ? [noCondition] : [...conditions.filter((c) => c !== noCondition), code];
}

export function conditionLabels(conditions: string[], other: string | null) {
  return conditions.map((code) => (code === otherCondition && other ? other
    : healthConditions.find((c) => c.code === code)?.label ?? code));
}
