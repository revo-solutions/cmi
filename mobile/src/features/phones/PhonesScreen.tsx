import { useNavigation } from '@react-navigation/native';
import { Phone, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { phones } from '../../content';
import { colors } from '../../theme';
import { callUrl } from '../contact/contact';
import { ContactActions } from '../contact/ContactActions';
import { useContact } from '../contact/store';
import { phoneCategories } from './phones';

const categories = phoneCategories(phones);

export function PhonesScreen() {
  const navigation = useNavigation();
  const contact = useContact();
  // The number whose call didn't open, so the message shows under its button.
  const [failed, setFailed] = useState<string | null>(null);

  const call = (number: string) => {
    setFailed(null);
    Linking.openURL(callUrl(number)).catch(() => setFailed(number));
  };

  return (
    <Screen title="Telefones" onProfile={() => navigation.navigate('Profile')}>
      {contact && (
        <Card>
          <AppText variant="support">Seu contato de confiança</AppText>
          <AppText variant="title">{contact.name}</AppText>
          <ContactActions contact={contact} />
        </Card>
      )}
      {contact === null && (
        <Card>
          <AppText>Cadastre um contato de confiança para ligar para ele daqui com um toque.</AppText>
          <Button label="Cadastrar contato" variant="secondary" icon={UserPlus} onPress={() => navigation.navigate('Contact')} />
        </Card>
      )}

      {categories.map((category) => (
        <View key={category.name} style={styles.section}>
          <AppText variant="title" accessibilityRole="header">{category.name}</AppText>
          {category.phones.map((phone) => (
            <Card key={phone.number}>
              <AppText bold>{phone.name}</AppText>
              <Button
                label={`Ligar ${phone.number}`}
                accessibilityLabel={`Ligar para ${phone.name}, ${phone.number.split('').join(' ')}`}
                variant={phone.emergency ? 'danger' : 'secondary'}
                icon={Phone}
                onPress={() => call(phone.number)}
              />
              {failed === phone.number && (
                <AppText accessibilityRole="alert" color={colors.red700}>
                  Este celular não conseguiu abrir a ligação. Disque {phone.number}.
                </AppText>
              )}
            </Card>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
});
