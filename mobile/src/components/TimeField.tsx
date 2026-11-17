import { StyleSheet, View } from 'react-native';

import { stepHour, stepMinute, type Time } from '../lib/dateFields';
import { NumberField } from './NumberField';

// Hour and minute on rows of their own, as in the canvas prototype: side by side they don't fit a phone.
export function TimeField({ value, onChange }: { value: Time; onChange: (value: Time) => void }) {
  return (
    <View style={styles.field}>
      <NumberField
        label="Hora"
        value={value.hour}
        digits={2}
        onStep={(delta) => onChange(stepHour(value, delta))}
        onType={(hour) => {
          if (hour <= 23) {
            onChange({ ...value, hour });
          }
        }}
      />
      <NumberField
        label="Minuto"
        value={value.minute}
        digits={2}
        onStep={(delta) => onChange(stepMinute(value, delta))}
        onType={(minute) => {
          if (minute <= 59) {
            onChange({ ...value, minute });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 10,
  },
});
