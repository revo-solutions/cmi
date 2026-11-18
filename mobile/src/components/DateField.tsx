import { useRef, type ComponentRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { dayLimit, stepDate, type DateDraft, type DateParts, type YearRange } from '../lib/dateFields';
import { NumberField } from './NumberField';

type DateFieldProps = {
  value: DateDraft;
  onChange: (value: DateDraft) => void;
  years: YearRange;
};

// Day, month and year in large fields, one per row, such as the birth date (AGENTS.md, "Product rules").
export function DateField({ value, onChange, years }: DateFieldProps) {
  const monthInput = useRef<ComponentRef<typeof TextInput>>(null);
  const yearInput = useRef<ComponentRef<typeof TextInput>>(null);
  const clear = (field: keyof DateParts) => onChange({ ...value, [field]: null });
  const type = (field: keyof DateParts, typed: number) => {
    const lastDay = dayLimit(value);
    const problem = field === 'day' && (typed < 1 || typed > lastDay) ? `Digite um dia de 1 a ${lastDay}.`
      : field === 'month' && (typed < 1 || typed > 12) ? 'Digite um mês de 1 a 12.'
      : field === 'year' && (typed < years.min || typed > years.max) ? `Digite um ano de ${years.min} a ${years.max}.`
      : undefined;
    if (problem) {
      clear(field);
      return problem;
    }
    const next = { ...value, [field]: typed };
    onChange({ ...next, day: next.day === null ? null : Math.min(next.day, dayLimit(next)) });
  };

  return (
    <View style={styles.field}>
      <NumberField
        label="Dia" value={value.day} digits={2} hint="Digite o dia em que você nasceu."
        onStep={(delta) => onChange(stepDate(value, 'day', delta, years))}
        onType={(day) => type('day', day)} onClear={() => clear('day')}
        onNext={() => monthInput.current?.focus()}
      />
      <NumberField
        ref={monthInput} label="Mês" value={value.month} digits={2} hint="Digite o mês em números, de 1 a 12."
        onStep={(delta) => onChange(stepDate(value, 'month', delta, years))}
        onType={(month) => type('month', month)} onClear={() => clear('month')}
        onNext={() => yearInput.current?.focus()}
      />
      <NumberField
        ref={yearInput} label="Ano" value={value.year} digits={4} hint="Digite o ano com quatro números."
        onStep={(delta) => onChange(stepDate(value, 'year', delta, years))}
        onType={(year) => type('year', year)} onClear={() => clear('year')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 10,
  },
});
