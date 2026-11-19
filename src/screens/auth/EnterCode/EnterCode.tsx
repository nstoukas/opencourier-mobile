import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { AuthScreen, AuthScreenProp } from '@app/navigation/auth/types';
import { Button, ButtonType } from '@app/components/Button/Button';
import { TextField } from '@app/components/TextField/TextField';
import { services } from '@app/services/service';
import { markJustLoggedIn } from '@app/services/afterLogin';
import useUser from '@app/hooks/useUser';
import { AuthFrame } from '../AuthFrame';
import { authStyles } from '../auth.styles';
import { showAuthError } from '../showAuthError';

type Props = AuthScreenProp<AuthScreen.EnterCode>;

// How long before "Send a new code" works (AC-6): the server makes at most one
// code a minute per account, so an earlier ask would only be ignored.
export const RESEND_WAIT_SECONDS = 60;

// The rules the server checks too (AC-10, AC-11). Checked here first, so a
// malformed code or password never costs one of the code's five tries.
export const isCodeComplete = (code: string): boolean => /^\d{6}$/.test(code);
export const isNewPasswordLongEnough = (password: string): boolean =>
  password.length >= 8 && password.length <= 72;

const secondsLeft = (sentAt: number, now: number): number =>
  Math.max(0, RESEND_WAIT_SECONDS - Math.floor((now - sentAt) / 1000));

// Types the emailed code and a new password, then logs in (row 17, spec 0039,
// AC-6, AC-10, AC-11). The reset signs every other phone out.
export const EnterCode = ({ navigation, route }: Props) => {
  const { email } = route.params;
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  // The countdown is worked out from when the last code was asked for, so it
  // stays right while the app is in the background.
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const wait = secondsLeft(sentAt, now);

  const reset = useMutation({
    mutationFn: services.userService.resetPassword,
    onSuccess: () => markJustLoggedIn(),
    onError: error => showAuthError(error, 'reset'),
  });
  // Once the new session is saved, loading the user opens the main app.
  useUser(reset.data !== undefined);

  const resend = useMutation({
    mutationFn: services.userService.forgotPassword,
    onSuccess: () => {
      setSentAt(Date.now());
      setNow(Date.now());
      setResent(true);
    },
    onError: error => showAuthError(error, 'forgot'),
  });

  const canSubmit =
    isCodeComplete(code) &&
    isNewPasswordLongEnough(password) &&
    !reset.isPending;
  const submit = () => reset.mutate({ email, code, password });

  return (
    <AuthFrame onBack={() => navigation.goBack()}>
      <Text style={authStyles.title} accessibilityRole="header">
        {t('translations:enter_code_title')}
      </Text>
      <Text style={authStyles.body}>
        {t('translations:enter_code_body', { email })}
      </Text>
      <TextField
        value={code}
        placeholder={t('translations:code_label')}
        // Digits only: a pasted code with spaces still works.
        onChangeText={text => setCode(text.replace(/\D/g, '').slice(0, 6))}
        style={authStyles.field}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        accessibilityLabel={t('translations:code_label')}
      />
      <TextField
        value={password}
        placeholder={t('translations:new_password')}
        onChangeText={setPassword}
        secureTextEntry
        maxLength={72}
        style={authStyles.field}
        autoCorrect={false}
        autoComplete="password-new"
        textContentType="newPassword"
        accessibilityLabel={t('translations:new_password')}
        onSubmitEditing={() => canSubmit && submit()}
      />
      <Text style={authStyles.hint}>{t('translations:new_password_hint')}</Text>
      <Button
        type={ButtonType.black}
        title={t('translations:set_password_and_log_in')}
        onPress={submit}
        disabled={!canSubmit}
        isLoading={reset.isPending}
        style={authStyles.primaryButton}
      />
      <TouchableOpacity
        style={authStyles.link}
        disabled={wait > 0 || resend.isPending}
        accessibilityRole="button"
        onPress={() => resend.mutate(email)}>
        <Text
          style={[
            authStyles.linkText,
            (wait > 0 || resend.isPending) && authStyles.linkTextDisabled,
          ]}>
          {wait > 0
            ? t('translations:send_new_code_in', { seconds: wait })
            : t('translations:send_new_code')}
        </Text>
      </TouchableOpacity>
      {resent && wait > 0 && (
        <Text style={authStyles.confirmation} accessibilityLiveRegion="polite">
          {t('translations:code_sent_again')}
        </Text>
      )}
    </AuthFrame>
  );
};
