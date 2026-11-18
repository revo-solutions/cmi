import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BellRing, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState, BackHandler, Linking } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { reconcileReminders, reminderPermission, type ReminderPermission } from '../../lib/reminders';
import { useSession } from '../../lib/session';
import { ContactForm } from '../contact/ContactForm';
import { SharingList } from '../contact/SharingList';
import { useContact } from '../contact/store';
import { useMedications } from '../medications/store';
import { AboutForm } from '../profile/AboutScreen';
import { BatteryCard } from '../profile/BatteryCard';
import { HealthForm } from '../profile/HealthScreen';
import { LocationCard } from '../sos/LocationCard';
import { askHealthLater, setupSteps, useSetup, type SetupStep } from './setup';

const titles: Record<Exclude<SetupStep, 'done'>, string> = {
  about: 'Sobre você',
  health: 'Sua saúde',
  medications: 'Seus remédios',
  contact: 'Contato de confiança',
  permissions: 'Permissões',
};

// The first-run setup, one step at a time in a fixed order; it resumes where it stopped (docs/escopo.md).
export function SetupScreen() {
  const { step, setStep } = useSetup();
  const accountId = useSession()?.accountId ?? '';
  if (step === 'done') {
    return null;
  }
  const index = setupSteps.indexOf(step);
  const next = () => setStep(setupSteps[index + 1] ?? 'done');
  const back = index > 0 ? () => setStep(setupSteps[index - 1]) : undefined;
  // Continuing with nothing answered is a skip too; once answered, the Hoje card stays hidden anyway.
  const afterHealth = () => void askHealthLater(accountId).then(next);

  return (
    <Screen title={titles[step]} subtitle={`Passo ${index + 1} de ${setupSteps.length}`} onBack={back}>
      <BackToPreviousStep back={back} />
      {step === 'about' && <AboutForm submitLabel="Continuar" onSaved={next} />}
      {step === 'health' && <HealthForm submitLabel="Continuar" onSaved={afterHealth} onSkip={afterHealth} />}
      {step === 'medications' && <MedicationsStep onDone={next} />}
      {step === 'contact' && <ContactStep onDone={next} />}
      {step === 'permissions' && <PermissionsStep onDone={next} />}
    </Screen>
  );
}

// Setup is a single screen, so Android's back button would close the app instead of going back a step. Only while
// focused: the medication form opened on top handles its own back.
function BackToPreviousStep({ back }: { back?: () => void }) {
  useFocusEffect(useCallback(() => {
    if (!back) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => subscription.remove();
  }, [back]));
  return null;
}

function MedicationsStep({ onDone }: { onDone: () => void }) {
  const navigation = useNavigation();
  const medications = useMedications()?.filter((m) => !m.deleted);

  return (
    <>
      <AppText>Cadastre os remédios que você toma para receber um lembrete na hora de cada um.</AppText>
      {medications?.map((medication) => (
        <Card key={medication.id}>
          <AppText variant="title">{medication.name}</AppText>
          <AppText bold>{medication.times.join(' · ')}</AppText>
        </Card>
      ))}
      <Button
        label={medications?.length ? 'Adicionar outro remédio' : 'Adicionar remédio'}
        variant={medications?.length ? 'secondary' : 'primary'}
        icon={Plus}
        onPress={() => navigation.navigate('MedicationForm', {})}
      />
      {!medications?.length && <AppText variant="support">Você também pode cadastrar depois, na aba Remédios.</AppText>}
      <Button label={medications?.length ? 'Continuar' : 'Cadastrar depois'} variant={medications?.length ? 'primary' : 'secondary'} onPress={onDone} />
    </>
  );
}

// Optional. Once saved, the step shows the medications it now shares, to uncheck any before going on.
function ContactStep({ onDone }: { onDone: () => void }) {
  const contact = useContact();
  const [editing, setEditing] = useState(false);

  if (contact === undefined) {
    return null;
  }
  if (!contact || editing) {
    return (
      <>
        {!contact && (
          <AppText>
            Alguém da família ou um amigo para você ligar, mandar SMS e pedir ajuda pelo botão SOS. Pode ser
            cadastrado agora ou depois, no Perfil.
          </AppText>
        )}
        <ContactForm contact={contact} submitLabel="Salvar contato" onSaved={() => setEditing(false)} />
        {!contact && <Button label="Cadastrar depois" variant="secondary" onPress={onDone} />}
      </>
    );
  }
  return (
    <>
      <Card>
        <AppText variant="title">{contact.name}</AppText>
        <AppText>{contact.phone}</AppText>
        <Button label="Editar" accessibilityLabel={`Editar ${contact.name}`} variant="secondary" onPress={() => setEditing(true)} />
      </Card>
      <SharingList contact={contact} />
      <Button label="Continuar" onPress={onDone} />
    </>
  );
}

function PermissionsStep({ onDone }: { onDone: () => void }) {
  const [permission, setPermission] = useState<ReminderPermission>();

  const check = useCallback(() => {
    reminderPermission(false).then(setPermission).catch(() => setPermission('notifications-denied'));
  }, []);

  useEffect(() => {
    check();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => subscription.remove();
  }, [check]);

  const ask = async () => {
    const result = await reminderPermission(true);
    setPermission(result);
    if (result === 'notifications-denied') {
      await Linking.openSettings();
    }
  };

  const finish = () => {
    void reconcileReminders().catch(() => undefined);
    onDone();
  };

  return (
    <>
      <Card>
        {permission === 'granted' ? (
          <AppText accessibilityLiveRegion="polite">Os lembretes estão ligados.</AppText>
        ) : (
          <>
            <AppText>
              {permission === 'exact-alarm-denied'
                ? 'Libere “Alarmes e lembretes” para o aviso tocar na hora certa.'
                : 'Para o celular avisar a hora de cada remédio, o app precisa poder mandar notificações.'}
            </AppText>
            <Button label="Ligar os lembretes" icon={BellRing} onPress={() => void ask()} />
          </>
        )}
      </Card>
      <BatteryCard />
      {permission !== 'granted' && (
        <AppText variant="support">Sem os lembretes, você ainda pode usar o app e marcar as doses pela tela Hoje.</AppText>
      )}
      <LocationCard />
      <Button label="Começar a usar" variant={permission === 'granted' ? 'primary' : 'secondary'} onPress={finish} />
    </>
  );
}
