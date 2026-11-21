import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { styles } from './EmergencyContact.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { TextField } from '@app/components/TextField/TextField';
import { Button, ButtonType } from '@app/components/Button/Button';
import { Icon } from '@app/components/Icon/Icon';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { FloppyDiskBackIcon } from 'phosphor-react-native/src/icons/FloppyDiskBack';
import {
  fetchEmergencyContact,
  saveEmergencyContact,
} from '@app/services/account/accountApi';

type Props = MainScreenProp<MainScreens.EmergencyContact>;

// Spec 0051 (cross check 12): the rider's emergency contact is kept on the server, so the co-op can see it
// on the rider's page and when they send an SOS. The old screen saved nothing at all (its Save did
// nothing), so there is no value on any phone to carry over. A name and a phone, both optional.
export const EmergencyContact = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchEmergencyContact()
      .then(contact => {
        setName(contact.name ?? '');
        setPhone(contact.phone ?? '');
      })
      .catch(() => undefined);
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await saveEmergencyContact({
        name: name.trim() || null,
        phone: phone.trim() || null,
      });
      Alert.alert(t('translations:emergency_contact_saved'));
      navigation.goBack();
    } catch {
      Alert.alert(t('translations:emergency_contact_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>
            {t('translations:emergency_contact')}
          </Text>
        </View>
        {/* Android 15 draws edge to edge, so padding is needed on Android too (row 114). */}
        <KeyboardAvoidingView style={styles.safe} behavior="padding">
          <ScrollView contentContainerStyle={styles.scroll}>
            <TextField
              value={name}
              placeholder={t('translations:emergency_contact_name')}
              onChangeText={setName}
              maxLength={120}
              style={styles.textField}
            />
            <TextField
              value={phone}
              placeholder={t('translations:emergency_contact_phone')}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={32}
              style={[styles.textField, { marginBottom: 2 }]}
            />
            <View style={styles.containerHorizontal}>
              <Icon icon={InfoIcon} weight="fill" size={14} />
              <Text style={styles.textInfo}>
                {t('translations:include_code')}
              </Text>
            </View>
            <Button
              type={ButtonType.green}
              title={t('translations:save')}
              onPress={save}
              disabled={busy}
              icon={FloppyDiskBackIcon}
              iconWeight="fill"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenSafeArea>
    </View>
  );
};
