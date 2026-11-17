import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useRows } from '../../lib/db';
import { pendingNoticeMs } from '../../lib/outbox';
import { useSession } from '../../lib/session';
import { requestSync, useSyncBlocked } from '../../lib/sync';

type Pending = { created_at: string; last_error: string | null };

export function SyncStatusCard() {
  const navigation = useNavigation();
  const accountId = useSession()?.accountId ?? '';
  const blocked = useSyncBlocked(accountId);
  const pending = useRows<Pending>('SELECT created_at, last_error FROM outbox ORDER BY id LIMIT 1')?.[0];
  const [now, setNow] = useState(Date.now);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!pending) {
      return;
    }
    const wait = Math.max(0, Date.parse(pending.created_at) + pendingNoticeMs - Date.now());
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [pending]);

  if (blocked) {
    return (
      <Card accessibilityLiveRegion="polite">
        <AppText bold>Sincronização pausada</AppText>
        <AppText>Sua conta foi aberta em outro celular.</AppText>
        <Button label="Usar neste celular" variant="secondary" onPress={() => navigation.navigate('DeviceConflict')} />
      </Card>
    );
  }
  if (!pending || (pending.last_error !== 'server' && now - Date.parse(pending.created_at) < pendingNoticeMs)) {
    return null;
  }

  return (
    <Card accessibilityLiveRegion="polite" accessibilityState={{ busy: retrying }}>
      <AppText bold>{pending.last_error === 'server' ? 'Não foi possível sincronizar' : 'Envio pendente'}</AppText>
      <AppText>Suas alterações estão salvas neste celular e serão enviadas quando a conexão voltar.</AppText>
      <Button label="Tentar sincronizar" variant="secondary" disabled={retrying} onPress={() => {
        setRetrying(true);
        void requestSync(true).finally(() => setRetrying(false));
      }} />
    </Card>
  );
}
