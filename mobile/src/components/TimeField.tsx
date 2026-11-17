import { stepHour, stepMinute, type Time } from '../lib/dateFields';
import { NumberField } from './NumberField';
import { Row } from './Row';

export function TimeField({ value, onChange }: { value: Time; onChange: (value: Time) => void }) {
  return (
    <Row>
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
    </Row>
  );
}
