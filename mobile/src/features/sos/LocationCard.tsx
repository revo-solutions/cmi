import { MapPin } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { locationPermission } from '../../lib/location';

type State = 'granted' | 'ask' | 'settings';

// Asked for here, in the setup and the profile, so the SOS screen never shows a system dialog.
export function LocationCard() {
  const [state, setState] = useState<State>();

  const check = useCallback((ask = false) => {
    locationPermission(ask)
      .then((permission) => setState(permission.granted ? 'granted' : permission.canAskAgain ? 'ask' : 'settings'))
      .catch(() => setState('ask'));
  }, []);

  useEffect(() => {
    check();
    const subscription = AppState.addEventListener('change', (next) => next === 'active' && check());
    return () => subscription.remove();
  }, [check]);

  if (!state) {
    return null;
  }
  return (
    <Card>
      <AppText variant="title" accessibilityRole="header">Localização no pedido de ajuda</AppText>
      {state === 'granted' ? (
        <AppText accessibilityLiveRegion="polite">O pedido de ajuda leva o lugar onde você está.</AppText>
      ) : (
        <>
          <AppText>
            Com a localização liberada, o pedido de ajuda leva um link do mapa com o lugar onde você está. O app só usa a
            localização quando você pede ajuda.
          </AppText>
          <Button
            label="Liberar a localização"
            variant="secondary"
            icon={MapPin}
            onPress={() => (state === 'settings' ? void Linking.openSettings() : check(true))}
          />
        </>
      )}
    </Card>
  );
}
