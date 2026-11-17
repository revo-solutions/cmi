import { useNavigation } from '@react-navigation/native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useSession } from '../../lib/session';
import { localDate } from '../medications/doses';
import { useProfile } from '../profile/store';
import { askHealthLater, isHealthCardDue, useHealthAskedOn } from '../setup/setup';

// Asks again for the health questionnaire skipped during setup.
export function HealthCard() {
  const navigation = useNavigation();
  const accountId = useSession()?.accountId ?? '';
  const profile = useProfile();
  const askedOn = useHealthAskedOn(accountId);
  const today = localDate(new Date());

  if (!profile || askedOn === undefined || !isHealthCardDue(profile, askedOn, today)) {
    return null;
  }

  return (
    <Card>
      <AppText bold>Quer contar um pouco sobre sua saúde?</AppText>
      <AppText>São poucas perguntas, e ajudam a mostrar artigos que combinam com você.</AppText>
      <Button label="Responder agora" onPress={() => navigation.navigate('ProfileHealth')} />
      <Button label="Agora não" variant="secondary" onPress={() => void askHealthLater(accountId, today)} />
    </Card>
  );
}
