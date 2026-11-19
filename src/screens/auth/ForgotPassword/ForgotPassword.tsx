import React, { useState } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { AuthScreen, AuthScreenProp } from '@app/navigation/auth/types';
import { Button, ButtonType } from '@app/components/Button/Button';
import { TextField } from '@app/components/TextField/TextField';
import { services } from '@app/services/service';
import { validateEmail } from '@app/utilities/text';
import { AuthFrame } from '../AuthFrame';
import { authStyles } from '../auth.styles';
import { showAuthError } from '../showAuthError';

type Props = AuthScreenProp<AuthScreen.ForgotPassword>;

// Asks for a reset code by email (row 17, spec 0039, AC-6). The server answers
// the same for every email, so any success moves on to Enter code.
export const ForgotPassword = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState(route.params.email);
  const trimmed = email.trim();

  const { mutate, isPending } = useMutation({
    mutationFn: services.userService.forgotPassword,
    onSuccess: () =>
      navigation.navigate(AuthScreen.EnterCode, { email: trimmed }),
    // 503 (mail off) and 429 stay on this screen with their sentence.
    onError: error => showAuthError(error, 'forgot'),
  });

  const canSend = validateEmail(trimmed) && !isPending;

  return (
    <AuthFrame onBack={() => navigation.goBack()}>
      <Text style={authStyles.title} accessibilityRole="header">
        {t('translations:forgot_title')}
      </Text>
      <Text style={authStyles.body}>{t('translations:forgot_body')}</Text>
      <TextField
        value={email}
        placeholder={t('translations:email')}
        onChangeText={setEmail}
        style={authStyles.field}
        keyboardType="email-address"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        accessibilityLabel={t('translations:email')}
        onSubmitEditing={() => canSend && mutate(trimmed)}
      />
      <Button
        type={ButtonType.black}
        title={t('translations:send_code')}
        onPress={() => mutate(trimmed)}
        disabled={!canSend}
        isLoading={isPending}
        style={authStyles.primaryButton}
      />
    </AuthFrame>
  );
};
