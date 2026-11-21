import { Alert } from 'react-native';
import i18n from '@app/localization/i18n';
import { authErrorKey, AuthScreenKind } from '@app/utilities/authErrors';
import { errorCodeOf } from '@app/services/account/sessionEndNotice';

// Shows a failed request's sentence in an Alert (row 17, spec 0039, AC-5): only
// after the rider tried, in plain words, never an HTTP code.
export const showAuthError = (error: unknown, screen: AuthScreenKind): void => {
  // Spec 0051 (AC-2): a deactivated account is told so in the server's words, which name how to reach the co-op.
  const { code, message } = errorCodeOf(error);
  if (code === 'ACCOUNT_DEACTIVATED') {
    Alert.alert(
      i18n.t('translations:session_deactivated_title'),
      message ?? i18n.t('translations:session_deactivated_body'),
    );
    return;
  }
  Alert.alert(
    i18n.t('translations:auth_error_title'),
    i18n.t(`translations:${authErrorKey(error, screen)}`),
  );
};
