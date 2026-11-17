import { StyleSheet, View } from 'react-native';

import { daysInMonth, stepDate, type DateParts } from '../lib/dateFields';
import { NumberField } from './NumberField';

type DateFieldProps = {
  value: DateParts;
  onChange: (value: DateParts) => void;
  years: { min: number; max: number };
};

// Day, month and year in large fields, one per row, such as the birth date (AGENTS.md, "Product rules").
export function DateField({ value, onChange, years }: DateFieldProps) {
  const type = (field: keyof DateParts, typed: number) => {
    const next = { ...value, [field]: typed };
    const fits = field === 'year'
      ? typed >= years.min && typed <= years.max
      : typed >= 1 && (field === 'month' ? typed <= 12 : typed <= daysInMonth(value.month, value.year));
    if (fits) {
      onChange({ ...next, day: Math.min(next.day, daysInMonth(next.month, next.year)) });
    }
  };

  return (
    <View style={styles.field}>
      <NumberField label="Dia" value={value.day} digits={2} onStep={(delta) => onChange(stepDate(value, 'day', delta, years))} onType={(day) => type('day', day)} />
      <NumberField label="Mês" value={value.month} digits={2} onStep={(delta) => onChange(stepDate(value, 'month', delta, years))} onType={(month) => type('month', month)} />
      <NumberField label="Ano" value={value.year} digits={4} onStep={(delta) => onChange(stepDate(value, 'year', delta, years))} onType={(year) => type('year', year)} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 10,
  },
});
