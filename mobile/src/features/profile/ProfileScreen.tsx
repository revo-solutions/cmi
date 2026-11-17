import { useNavigation } from '@react-navigation/native';

import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { YesNo } from '../../components/YesNo';
import { useDisplayMode } from '../../lib/displayMode';

// The large-text mode is here from phase 1; the rest of the profile comes with the phases that need it.
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
    </Screen>
  );
}
