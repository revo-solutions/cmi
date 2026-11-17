import { BellRing } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { reconcileReminders, reminderPermission, type ReminderPermission } from '../../lib/reminders';

const texts = {
  'notifications-denied': {
    message: 'Os lembretes estão desligados. Sem eles, o celular não avisa a hora do remédio.',
    action: 'Ligar os lembretes',
  },
  'exact-alarm-denied': {
    message: 'Libere “Alarmes e lembretes” para o aviso tocar na hora certa.',
    action: 'Liberar',
  },
};

// Shown on Hoje while reminders can't ring on time; checked again on coming back from the system settings.
export function ReminderPermissionCard() {
  const [permission, setPermission] = useState<ReminderPermission>('granted');

  const check = useCallback(() => {
    reminderPermission(false)
      .then(setPermission)
      .catch((error: unknown) => console.warn('Não foi possível ler a permissão dos lembretes.', error));
  }, []);

  useEffect(() => {
    check();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => subscription.remove();
  }, [check]);

  if (permission === 'granted') {
    return null;
  }

  const ask = async () => {
    const result = await reminderPermission(true);
    setPermission(result);
    if (result === 'notifications-denied') {
      await Linking.openSettings();
    } else if (result === 'granted') {
      await reconcileReminders();
    }
  };

  return (
    <Card>
      <AppText>{texts[permission].message}</AppText>
      <Button label={texts[permission].action} icon={BellRing} onPress={() => void ask()} />
    </Card>
  );
}
