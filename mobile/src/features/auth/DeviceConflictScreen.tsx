import { useNavigation } from '@react-navigation/native';
import { useRef, useState } from 'react';

import { ApiError, ApiUnavailableError } from '../../api/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { requestHeartbeat } from '../../lib/heartbeat';
import { reconcileReminders } from '../../lib/reminders';
import { reactivateDevice, requestSync } from '../../lib/sync';

export function DeviceConflictScreen() {
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submitting = useRef(false);

  async function activate() {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    setBusy(true);
    setMessage('');
    try {
      await reactivateDevice();
      void reconcileReminders().catch(() => undefined);
      void requestSync();
      void requestHeartbeat();
      navigation.goBack();
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setMessage('Confira a conexão e tente novamente.');
      } else if (error instanceof ApiError && error.status === 409) {
        setMessage('A conta foi aberta de novo em outro celular. Tente novamente.');
      } else {
        setMessage('Não foi possível usar a conta neste celular. Tente novamente.');
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen title="Sua conta foi aberta em outro celular">
      <Card accessibilityState={{ busy }}>
        <AppText>Seus registros ficam salvos neste aparelho enquanto a sincronização estiver pausada.</AppText>
        <AppText>
          Ao usar a conta neste celular, vamos baixar os dados salvos no servidor e enviar os registros pendentes
          de doses dos remédios que já estavam sincronizados.
        </AppText>
        <AppText>
          Edições que ainda não foram enviadas e doses de remédios cadastrados só neste aparelho serão descartadas.
        </AppText>
        <Button label="Usar neste celular" onPress={() => void activate()} disabled={busy} />
        <Button label="Continuar sem sincronizar" variant="secondary" onPress={() => navigation.goBack()} disabled={busy} />
        {busy && <AppText accessibilityLiveRegion="polite">Recuperando sua conta…</AppText>}
        {message !== '' && <AppText accessibilityRole="alert" accessibilityLiveRegion="assertive">{message}</AppText>}
      </Card>
    </Screen>
  );
}
