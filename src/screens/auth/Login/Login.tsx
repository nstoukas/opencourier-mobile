import React, { useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { AuthScreen, AuthScreenProp } from '@app/navigation/auth/types';
import { Button, ButtonType } from '@app/components/Button/Button';
import { TextField } from '@app/components/TextField/TextField';
import { services } from '@app/services/service';
import { markJustLoggedIn } from '@app/services/afterLogin';
import useUser from '@app/hooks/useUser';
import { Images } from '@app/utilities/images';
import { hasUsableAddress } from '@app/utilities/config';
import { AuthFrame } from '../AuthFrame';
import { authStyles } from '../auth.styles';
import { showAuthError } from '../showAuthError';
import { sendLanguageToServer } from '@app/localization/languageApi';

type Props = AuthScreenProp<AuthScreen.Login>;

// The first screen a logged out rider sees (row 17, spec 0039, AC-1, AC-5):
// the co-op's logo and name, email and password, and the way to a reset.
// No instance step: the server is fixed by the build.
export const Login = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { data, mutate, isPending } = useMutation({
    mutationFn: services.userService.login,
    onSuccess: () => {
      markJustLoggedIn();
      // The server words this rider's emails in the phone's language (spec 0054, decision 47.33).
      sendLanguageToServer();
    },
    onError: error => showAuthError(error, 'login'),
  });

  // Once logged in, loading the user makes the router swap to the main app.
  useUser(data !== undefined);

  // AC-4: a release build without the co-op's https address sends nothing.
  const canSubmit =
    hasUsableAddress && !isPending && email.trim() !== '' && password !== '';

  return (
    <AuthFrame>
      <View style={authStyles.brand}>
        <Image
          source={Images.Logo}
          style={authStyles.logo}
          accessibilityIgnoresInvertColors
        />
        <Text style={authStyles.coopName} accessibilityRole="header">
          {t('translations:coop_name')}
        </Text>
        <Text style={authStyles.subtitle}>{t('translations:login_title')}</Text>
      </View>

      {!hasUsableAddress && (
        <View style={authStyles.notice} accessibilityRole="alert">
          <Text style={authStyles.noticeText}>
            {t('translations:build_without_address')}
          </Text>
        </View>
      )}

      <TextField
        value={email}
        placeholder={t('translations:email')}
        onChangeText={setEmail}
        style={authStyles.field}
        keyboardType="email-address"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        editable={hasUsableAddress}
        accessibilityLabel={t('translations:email')}
      />
      <TextField
        value={password}
        placeholder={t('translations:password')}
        onChangeText={setPassword}
        secureTextEntry
        style={authStyles.field}
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
        editable={hasUsableAddress}
        accessibilityLabel={t('translations:password')}
        onSubmitEditing={() => canSubmit && mutate({ email, password })}
      />
      <Button
        type={ButtonType.black}
        title={t('translations:log_in')}
        onPress={() => mutate({ email, password })}
        disabled={!canSubmit}
        isLoading={isPending}
        style={authStyles.primaryButton}
      />
      <TouchableOpacity
        style={authStyles.link}
        disabled={!hasUsableAddress}
        accessibilityRole="link"
        onPress={() =>
          navigation.navigate(AuthScreen.ForgotPassword, {
            email: email.trim(),
          })
        }>
        <Text
          style={[
            authStyles.linkText,
            !hasUsableAddress && authStyles.linkTextDisabled,
          ]}>
          {t('translations:forgot_password')}
        </Text>
      </TouchableOpacity>
    </AuthFrame>
  );
};
