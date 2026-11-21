import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import messaging from '@react-native-firebase/messaging';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { TextField } from '@app/components/TextField/TextField';
import { Button, ButtonType } from '@app/components/Button/Button';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { changePassword } from '@app/services/account/accountApi';
import { errorCodeOf } from '@app/services/account/sessionEndNotice';
import { styles } from '../EmergencyContact/EmergencyContact.styles';

type Props = MainScreenProp<MainScreens.ChangePassword>;

// The backend's rule (spec 0013): 8 to 72 characters.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

// This phone's push token, so it keeps its offer pushes; none on a phone without Firebase (a missing token
// only means the server removes this phone's device too, and the next start registers it again).
const thisPhonesPushToken = async (): Promise<string | undefined> => {
  try {
    return (await messaging().getToken()) || undefined;
  } catch {
    return undefined;
  }
};

// Spec 0051 (AC-8, cross check 13): the rider changes their own password after giving the current one.
// The server signs out their other phones and answers with fresh tokens for this one.
export const ChangePassword = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const lengthOk = next.length >= PASSWORD_MIN && next.length <= PASSWORD_MAX;
  const mismatch = again.length > 0 && again !== next;
  const canSave = current.length > 0 && lengthOk && again === next && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(undefined);
    try {
      await changePassword({
        currentPassword: current,
        newPassword: next,
        pushToken: await thisPhonesPushToken(),
      });
      Alert.alert(t('translations:password_changed'));
      navigation.goBack();
    } catch (failure) {
      // The server's sentence (wrong current password, the same password, too many tries) when it sent one.
      setError(
        errorCodeOf(failure).message ??
          t('translations:password_change_failed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('translations:change_password')}</Text>
        </View>
        {/* Android 15 draws edge to edge, so padding is needed on Android too (row 114). */}
        <KeyboardAvoidingView style={styles.safe} behavior="padding">
          <ScrollView contentContainerStyle={styles.scroll}>
            <TextField
              value={current}
              placeholder={t('translations:password_current')}
              onChangeText={setCurrent}
              secureTextEntry
              autoComplete="current-password"
              style={styles.textField}
            />
            <TextField
              value={next}
              placeholder={t('translations:password_new')}
              onChangeText={setNext}
              secureTextEntry
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              error={
                next.length > 0 && !lengthOk
                  ? t('translations:password_rules', {
                      min: PASSWORD_MIN,
                      max: PASSWORD_MAX,
                    })
                  : undefined
              }
              style={styles.textField}
            />
            <TextField
              value={again}
              placeholder={t('translations:password_new_again')}
              onChangeText={setAgain}
              secureTextEntry
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              error={mismatch ? t('translations:password_mismatch') : undefined}
              style={styles.textField}
            />
            {error ? (
              <Text
                style={styles.error}
                accessibilityRole="alert"
                testID="change-password-error">
                {error}
              </Text>
            ) : null}
            <Button
              type={ButtonType.green}
              title={t('translations:change_password')}
              onPress={save}
              disabled={!canSave}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenSafeArea>
    </View>
  );
};
