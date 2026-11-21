import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Colors } from '@app/styles/colors';
import { color, radius, typeScale } from '@app/styles/theme';
import {
  StatementFormat,
  fetchStatementMonths,
  openStatement,
} from '@app/services/statements/statementsApi';

// Spec 0050 (AC-8): Statements on Earnings. Every complete month since the rider joined, each with PDF and
// CSV; a line says what a statement holds and that it is not an invoice. Read on each visit, never saved on
// the phone (not in the persisted queries).
export const StatementsSection = () => {
  const { t, i18n } = useTranslation();
  const query = useQuery({
    queryKey: ['statementMonths'],
    queryFn: fetchStatementMonths,
    gcTime: 0,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const lang = i18n.language?.startsWith('el') ? 'el' : 'en';
  const months = query.data ?? [];

  const open = async (month: string, format: StatementFormat) => {
    setBusy(`${month}:${format}`);
    setFailed(false);
    try {
      await openStatement(month, format, lang);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.card} testID="statements">
      <Text style={styles.title} accessibilityRole="header">
        {t('translations:statements_title')}
      </Text>
      <Text style={styles.note}>{t('translations:statements_note')}</Text>
      {failed ? (
        <Text style={styles.error} accessibilityRole="alert">
          {t('translations:statements_failed')}
        </Text>
      ) : null}
      {query.isError ? (
        <Text style={styles.note}>
          {t('translations:statements_load_failed')}
        </Text>
      ) : months.length === 0 && !query.isLoading ? (
        <Text style={styles.note}>{t('translations:statements_none')}</Text>
      ) : (
        months.map(month => (
          <View key={month} style={styles.row} testID={`statement-${month}`}>
            <Text style={styles.month}>{month}</Text>
            {(['pdf', 'csv'] as StatementFormat[]).map(format => (
              <TouchableOpacity
                key={format}
                style={styles.button}
                disabled={busy !== null}
                onPress={() => open(month, format)}
                accessibilityRole="button"
                accessibilityLabel={t('translations:statements_open', {
                  month,
                  format: format.toUpperCase(),
                })}
                testID={`statement-${month}-${format}`}>
                <Text style={styles.buttonText}>
                  {busy === `${month}:${format}` ? '…' : format.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))
      )}
    </View>
  );
};

// The Earnings screen's own card look (Earnings.styles.ts, EarningsDelivery.styles.ts).
const styles = StyleSheet.create({
  card: {
    borderRadius: radius['2xl'],
    backgroundColor: Colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: typeScale.body.fontSize,
    fontWeight: '700',
    color: color.foreground,
    marginBottom: 6,
  },
  note: {
    fontSize: typeScale.caption.fontSize,
    color: Colors.gray13,
    marginBottom: 8,
  },
  error: {
    fontSize: typeScale.caption.fontSize,
    color: Colors.red1,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  month: {
    flex: 1,
    fontSize: typeScale['body-sm'].fontSize,
    color: Colors.black1,
  },
  button: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    minWidth: 56,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: typeScale['body-sm'].fontSize,
    fontWeight: '600',
    color: Colors.black1,
  },
});
