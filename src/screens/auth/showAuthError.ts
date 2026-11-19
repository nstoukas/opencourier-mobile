import { Alert } from 'react-native';
import i18n from '@app/localization/i18n';
import { authErrorKey, AuthScreenKind } from '@app/utilities/authErrors';

// Shows a failed request's sentence in an Alert (row 17, spec 0039, AC-5): only
// after the rider tried, in plain words, never an HTTP code.
export const showAuthError = (error: unknown, screen: AuthScreenKind): void => {
  Alert.alert(
    i18n.t('translations:auth_error_title'),
    i18n.t(`translations:${authErrorKey(error, screen)}`),
  );
};
