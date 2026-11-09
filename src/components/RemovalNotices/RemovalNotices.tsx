import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@app/components/Icon/Icon';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import {
  dismissRemovalNotice,
  useRemovalNotices,
} from '@app/services/removalNotice/removalNotice';
import {
  removalNoticeText,
  removalNoticeTitle,
} from '@app/utilities/removalRequest';
import { color, radius, typeScale } from '@app/styles/theme';

// Spec 0035 (AC-11): dispatch's answer to a removal request, on Home until the rider taps it.
// One card per order, and never a count of how many times a rider asked.
export const RemovalNotices = () => {
  const { t } = useTranslation();
  const notices = useRemovalNotices();
  if (notices.length === 0) {
    return null;
  }
  return (
    <View style={styles.list}>
      {notices.map(notice => {
        const approved = notice.outcome === 'APPROVED';
        return (
          <TouchableOpacity
            key={notice.deliveryId}
            style={[styles.card, approved ? styles.approved : styles.declined]}
            onPress={() => dismissRemovalNotice(notice.deliveryId)}
            accessibilityRole="button"
            testID="removal-notice">
            <Icon
              icon={approved ? CheckCircleIcon : WarningIcon}
              size={20}
              tone={approved ? 'success' : 'destructive'}
            />
            <View style={styles.words}>
              <Text style={styles.title}>{removalNoticeTitle(notice, t)}</Text>
              <Text style={styles.text}>{removalNoticeText(notice, t)}</Text>
            </View>
            <Text style={styles.close}>
              {t('translations:removal_notice_close')}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    padding: 12,
    marginBottom: 8,
    borderRadius: radius.md,
  },
  approved: {
    backgroundColor: color['success-soft'],
  },
  declined: {
    backgroundColor: color['destructive-soft'],
  },
  words: {
    flex: 1,
    marginHorizontal: 8,
  },
  title: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
    color: color.foreground,
  },
  text: {
    fontSize: typeScale.caption.fontSize,
    color: color.foreground,
  },
  close: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '700',
    color: color.foreground,
  },
});
