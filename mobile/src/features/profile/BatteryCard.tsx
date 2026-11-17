import { Settings } from 'lucide-react-native';
import { Linking, Platform } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';

// Xiaomi, Samsung and Motorola close apps to save battery (docs/arquitetura.md, "Pontos de atenção no Android").
export function BatteryCard() {
  if (Platform.OS !== 'android') {
    return null;
  }
  return (
    <Card>
      <AppText variant="title" accessibilityRole="header">Para os lembretes tocarem na hora</AppText>
      <AppText>
        Em alguns celulares, a economia de bateria atrasa os lembretes. Nos ajustes do app, em Bateria, escolha “Sem
        restrições”.
      </AppText>
      <Button label="Abrir os ajustes do app" variant="secondary" icon={Settings} onPress={() => void Linking.openSettings()} />
    </Card>
  );
}
