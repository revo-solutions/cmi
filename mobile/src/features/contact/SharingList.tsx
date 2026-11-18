import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { useMedications } from '../medications/store';
import { shareMedication, usePendingRevocation, type Contact } from './store';

// Which medications the contact follows. Shared by default; unchecking one is the opt-out (docs/escopo.md).
export function SharingList({ contact }: { contact: Contact }) {
  const medications = useMedications()?.filter((m) => !m.deleted);
  const pending = usePendingRevocation();

  if (!medications?.length) {
    return null;
  }

  return (
    <Card>
      <AppText variant="title" accessibilityRole="header">O que {contact.name} acompanha</AppText>
      <AppText>Os remédios marcados entram nos avisos para {contact.name}. Os desmarcados ficam só para você.</AppText>
      {medications.map((medication) => (
        <Chip
          key={medication.id}
          label={medication.name}
          selected={medication.sharedWithContact}
          onPress={() => void shareMedication(medication.id, !medication.sharedWithContact)}
        />
      ))}
      {medications.some((m) => !m.sharedWithContact && pending?.medications.has(m.id)) && (
        <AppText variant="support" accessibilityLiveRegion="polite">
          A mudança está salva neste celular e vale para {contact.name} quando for enviada pela internet.
        </AppText>
      )}
    </Card>
  );
}
