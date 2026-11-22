import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { color, space, typeScale } from '@app/styles/theme';

// "about 6 months" for 182 days: whole months, at least one. The backend words the How offers and
// pay work line the same way (work-rules.service.ts, aboutMonths).
export const aboutMonthsCount = (days: number): number =>
  Math.max(1, Math.round(days / 30.44));

type Props = {
  // The co-op's addressNoteRetentionDays from config/contact; undefined when not known yet.
  retentionDays?: number;
};

// Spec 0053 (AC-8): what notes are for, the personal data rule, the retention period, flagging and
// admin deletion. Shown the first time a rider adds a note and from the "How notes work" link.
export const AddressNotesRules = ({ retentionDays }: Props) => {
  const { t } = useTranslation();
  const retention =
    retentionDays !== undefined && retentionDays > 0
      ? t('translations:address_note_rules_retention', {
          days: retentionDays,
          months: t('translations:address_note_about_months', {
            count: aboutMonthsCount(retentionDays),
          }),
        })
      : t('translations:address_note_rules_retention_unknown');
  const lines = [
    t('translations:address_note_rules_for'),
    t('translations:address_note_rules_person'),
    retention,
    t('translations:address_note_rules_flag'),
    t('translations:address_note_rules_votes'),
  ];
  return (
    <View style={styles.list} testID="address-notes-rules">
      {lines.map((line, index) => (
        <Text key={index} style={styles.line}>
          {line}
        </Text>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: space['2'],
    paddingVertical: space['2'],
  },
  line: {
    ...typeScale['body-sm'],
    color: color.foreground,
  },
});
