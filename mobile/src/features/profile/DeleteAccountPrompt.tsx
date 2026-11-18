import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TextField } from '../../components/TextField';
import { colors } from '../../theme';

type DeleteAccountPromptProps = {
  name: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteAccountPrompt({ name, onCancel, onConfirm }: DeleteAccountPromptProps) {
  const [typedName, setTypedName] = useState('');
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const profileName = name?.trim();
  const expectedText = profileName || 'EXCLUIR';
  const matches = typedName.trim().normalize().toLowerCase() === expectedText.normalize().toLowerCase();

  function confirmName() {
    if (matches) {
      Keyboard.dismiss();
      setNameConfirmed(true);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card style={styles.prompt} accessibilityViewIsModal>
            <AppText variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
              {nameConfirmed ? 'Excluir sua conta?' : 'Excluir conta'}
            </AppText>
            {nameConfirmed ? (
              <>
                <AppText>Seus dados e registros serão apagados. Esta decisão é definitiva.</AppText>
                <Button label="Excluir conta" variant="danger" onPress={onConfirm} />
              </>
            ) : (
              <>
                <AppText>
                  {profileName ? `Para continuar, digite seu nome como aparece no perfil: ${profileName}.`
                    : `Para continuar, digite ${expectedText}.`}
                </AppText>
                <TextField
                  label={profileName ? 'Seu nome' : 'Palavra de confirmação'} value={typedName}
                  onChangeText={setTypedName} onSubmitEditing={confirmName} autoComplete="off" autoCorrect={false}
                  returnKeyType="done"
                />
                <Button label="Continuar" variant="danger" onPress={confirmName} disabled={!matches} />
              </>
            )}
            <Button label="Cancelar" variant="secondary" onPress={onCancel} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: `${colors.ink}99`,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  prompt: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
  },
});
