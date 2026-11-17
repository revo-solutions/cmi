import { useNavigation } from '@react-navigation/native';

import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { useRows } from '../../lib/db';

const today = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export function TodayScreen() {
  const navigation = useNavigation();
  const date = today.format(new Date());
  const medications = useRows<{ id: string }>('SELECT id FROM medications WHERE deleted = 0 LIMIT 1');

  return (
    <Screen title="Hoje" subtitle={date.charAt(0).toUpperCase() + date.slice(1)} onProfile={() => navigation.navigate('Profile')}>
      {medications?.length === 0 && (
        <Card>
          <AppText>Nenhum remédio cadastrado.</AppText>
        </Card>
      )}
    </Screen>
  );
}
