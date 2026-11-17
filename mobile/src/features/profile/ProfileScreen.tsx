import { useNavigation } from '@react-navigation/native';
import { Settings } from 'lucide-react-native';
import { Linking, Platform } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { YesNo } from '../../components/YesNo';
import { useDisplayMode } from '../../lib/displayMode';

// The rest of the profile comes with the phases that need it.
export function ProfileScreen() {
  const navigation = useNavigation();
  const { largeText, setLargeText } = useDisplayMode();

  return (
    <Screen title="Perfil" onBack={() => navigation.goBack()}>
      <Card>
        <YesNo
          question="Letras grandes e mais contraste"
          value={largeText}
          onChange={(on) => setLargeText(on ?? false)}
        />
        <AppText variant="support">Vale só para este celular e soma com o tamanho de letra do sistema.</AppText>
      </Card>

      {/* Xiaomi, Samsung and Motorola close apps to save battery (docs/arquitetura.md, "Pontos de atenção no Android"). */}
      {Platform.OS === 'android' && (
        <Card>
          <AppText variant="title" accessibilityRole="header">Para os lembretes tocarem na hora</AppText>
          <AppText>
            Em alguns celulares, a economia de bateria atrasa os lembretes. Nos ajustes do app, em Bateria, escolha “Sem
            restrições”.
          </AppText>
          <Button label="Abrir os ajustes do app" variant="secondary" icon={Settings} onPress={() => void Linking.openSettings()} />
        </Card>
      )}
    </Screen>
  );
}
