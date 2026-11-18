import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Relationship } from '../../api/generated/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { TextField } from '../../components/TextField';
import { colors } from '../../theme';
import { formatPhone, maxNameLength, maxPhoneDigits, phoneDigits, phoneProblem, relationshipLabels } from './contact';
import { saveContact, type Contact } from './store';

const relationships = Object.keys(relationshipLabels) as Relationship[];

// Name, phone and relationship: a step of setup and an edit from Perfil.
export function ContactForm({ contact, submitLabel, onSaved }: { contact: Contact | null; submitLabel: string; onSaved: () => void }) {
  const [name, setName] = useState(contact?.name ?? '');
  const [phone, setPhone] = useState(() => phoneDigits(contact?.phone ?? ''));
  const [relationship, setRelationship] = useState<Relationship | null>(contact?.relationship ?? null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const firstName = name.trim().split(/\s+/)[0];

  function changePhone(value: string) {
    const digits = phoneDigits(value);
    if (digits.length <= maxPhoneDigits) {
      setPhone(digits);
    }
  }

  const save = async () => {
    const problem = !name.trim() ? 'Escreva o nome do seu contato.'
      : phoneProblem(phone) || (!relationship ? 'Escolha o que você é para essa pessoa.' : '');
    setError(problem);
    if (problem || saving || !relationship) {
      return;
    }
    setSaving(true);
    try {
      // The server resets the WhatsApp link when the stored phone changes.
      const savedPhone = contact && phoneDigits(contact.phone) === phone ? contact.phone : formatPhone(phone);
      await saveContact({ name: name.trim(), phone: savedPhone, relationship });
      onSaved();
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TextField
        label="Nome" value={name} onChangeText={setName} autoCapitalize="words" maxLength={maxNameLength}
        placeholder="Ana"
      />
      <TextField
        label="Telefone com DDD" value={formatPhone(phone)} onChangeText={changePhone} keyboardType="number-pad"
        autoComplete="tel" textContentType="telephoneNumber" placeholder="(11) 98765-4321"
      />

      <View accessibilityRole="radiogroup" style={styles.group}>
        <AppText bold>{firstName ? `Para ${firstName}, você é:` : 'Para essa pessoa, você é:'}</AppText>
        {relationships.map((value) => (
          <Chip
            key={value}
            radio
            label={relationshipLabels[value]}
            selected={relationship === value}
            onPress={() => setRelationship(value)}
          />
        ))}
        <AppText variant="support">Os avisos usam isso: “Sua mãe, Maria, pediu ajuda”.</AppText>
      </View>

      {error !== '' && (
        <AppText accessibilityRole="alert" accessibilityLiveRegion="assertive" color={colors.orchid900}>{error}</AppText>
      )}
      <Button label={submitLabel} onPress={() => void save()} disabled={saving} />
    </>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
});
