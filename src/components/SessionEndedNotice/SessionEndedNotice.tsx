import React, { useSyncExternalStore } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, ButtonType } from '@app/components/Button/Button';
import { color, radius, typeScale } from '@app/styles/theme';
import {
  getSessionEndNotice,
  setSessionEndNotice,
  subscribeSessionEndNotice,
} from '@app/services/account/sessionEndNotice';

// Spec 0051 (AC-9): when the co-op deactivated the account, or the password or login email changed, the
// app says so on a full screen card instead of a generic error; OK leaves the login screen behind it.
// The deactivated words are the server's (they name how to reach the co-op).
export const SessionEndedNotice = () => {
  const { t } = useTranslation();
  // `useSyncExternalStore` reads a store that lives outside React and redraws when it changes.
  const notice = useSyncExternalStore(
    subscribeSessionEndNotice,
    getSessionEndNotice,
  );
  if (!notice) return null;
  const deactivated = notice.kind === 'deactivated';
  return (
    <Modal
      visible
      animationType="fade"
      onRequestClose={() => setSessionEndNotice(null)}>
      <View style={styles.screen} testID="session-ended-notice">
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.title}>
            {deactivated
              ? t('translations:session_deactivated_title')
              : t('translations:session_credentials_title')}
          </Text>
          <Text style={styles.text}>
            {deactivated
              ? notice.message ?? t('translations:session_deactivated_body')
              : t('translations:session_credentials_body')}
          </Text>
        </View>
        <Button
          type={ButtonType.green}
          title={t('translations:session_notice_ok')}
          onPress={() => setSessionEndNotice(null)}
        />
      </View>
    </Modal>
  );
};

// The cancelled job card's full screen look (CancelledJobCard.styles.ts).
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
    padding: 20,
    justifyContent: 'center',
  },
  banner: {
    backgroundColor: color.destructive,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 20,
  },
  title: {
    ...typeScale.h2,
    color: color['destructive-foreground'],
  },
  text: {
    ...typeScale.body,
    color: color['destructive-foreground'],
    marginTop: 4,
  },
});
