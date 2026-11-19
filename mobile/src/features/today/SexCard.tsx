import { useState } from 'react';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { colors } from '../../theme';
import { sexOptions } from '../profile/sex';
import { saveProfile, useProfile } from '../profile/store';

// Asks the sex of a profile made before setup asked it, until answered (docs/escopo.md).
export function SexCard() {
  const profile = useProfile();
  const [failed, setFailed] = useState(false);

  if (!profile?.updatedAt || profile.sex) {
    return null;
  }

  return (
    <Card>
      <AppText bold>Para o app falar com você do jeito certo: você é homem ou mulher?</AppText>
      {sexOptions.map((option) => (
        <Button
          key={option.value} label={option.label} variant="secondary"
          onPress={() => void saveProfile({ sex: option.value }).then(() => setFailed(false), () => setFailed(true))}
        />
      ))}
      {failed && (
        <AppText accessibilityRole="alert" accessibilityLiveRegion="assertive" color={colors.orchid900}>
          Não foi possível salvar. Tente novamente.
        </AppText>
      )}
    </Card>
  );
}
