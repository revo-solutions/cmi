import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import type { Relationship } from '../../api/generated/client';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { TextField } from '../../components/TextField';
import { colors } from '../../theme';
import { formatPhone, maxNameLength, maxPhoneDigits, phoneDigits, phoneProblem, relationshipLabels } from './contact';
import { saveContact, type Contact } from './store';

const relationships = Object.keys(relationshipLabels) as Relationship[];
type ErrorField = 'name' | 'phone' | 'relationship' | 'save';

// Name, phone and relationship: a step of setup and an edit from Perfil.
export function ContactForm({ contact, submitLabel, onSaved }: { contact: Contact | null; submitLabel: string; onSaved: () => void }) {
  const [name, setName] = useState(contact?.name ?? '');
  const [phone, setPhone] = useState(() => phoneDigits(contact?.phone ?? ''));
  const [relationship, setRelationship] = useState<Relationship | null>(contact?.relationship ?? null);
  const [errorField, setErrorField] = useState<ErrorField | null>(null);
  const [saving, setSaving] = useState(false);
  const phoneInput = useRef<ComponentRef<typeof TextInput>>(null);
  const firstName = name.trim().split(/\s+/)[0];
  const problems = {
    name: name.trim() ? '' : 'Escreva o nome do seu contato.',
    phone: phoneProblem(phone),
    relationship: relationship ? '' : 'Escolha o que você é para essa pessoa.',
    save: 'Não foi possível salvar. Tente novamente.',
  };
  const error = errorField ? problems[errorField] : '';

  function changePhone(value: string) {
    const digits = phoneDigits(value);
    if (digits.length <= maxPhoneDigits) {
      setPhone(digits);
    }
  }

  const save = async () => {
    const invalidField = problems.name ? 'name' : problems.phone ? 'phone' : !relationship ? 'relationship' : null;
    setErrorField(invalidField);
    if (invalidField || saving || !relationship) {
      return;
    }
    setSaving(true);
    try {
      // The server resets the WhatsApp link when the stored phone changes.
      const savedPhone = contact && phoneDigits(contact.phone) === phone ? contact.phone : formatPhone(phone);
      await saveContact({ name: name.trim(), phone: savedPhone, relationship });
      onSaved();
    } catch {
      setErrorField('save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TextField
        label="Nome do seu contato" value={name} onChangeText={setName} autoCapitalize="words" maxLength={maxNameLength}
        hint="Digite o nome do seu contato." returnKeyType="next" submitBehavior="submit"
        onSubmitEditing={() => phoneInput.current?.focus()}
      />
      <TextField
        ref={phoneInput} label="Telefone com DDD" value={formatPhone(phone)} onChangeText={changePhone}
        keyboardType="number-pad" returnKeyType="done" autoComplete="tel" textContentType="telephoneNumber"
        hint="Digite o DDD e o número do contato."
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
