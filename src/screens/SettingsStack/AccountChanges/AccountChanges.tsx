import React from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import {
  AccountChange,
  fetchAccountChanges,
} from '@app/services/account/accountApi';
import { coopClock, coopDate } from '@app/utilities/timeWorked';
import { styles } from '../EmergencyContact/EmergencyContact.styles';

type Props = MainScreenProp<MainScreens.AccountChanges>;
type Translate = (key: string, options?: Record<string, unknown>) => string;

// One change in words (AC-7): what changed and by whom, as "the co-op" or "you", never an admin's name.
export const accountChangeLine = (
  change: AccountChange,
  t: Translate,
): string => {
  const by = t(
    change.by === 'you'
      ? 'translations:account_change_by_you'
      : 'translations:account_change_by_coop',
  );
  switch (change.kind) {
    case 'DEACTIVATED':
      return t('translations:account_change_deactivated', { by });
    case 'REACTIVATED':
      return t('translations:account_change_reactivated', { by });
    case 'PASSWORD_CHANGED':
      return t('translations:account_change_password', { by });
    default: {
      const empty = t('translations:account_change_empty');
      return t('translations:account_change_field', {
        field: change.field
          ? t(`translations:account_field_${change.field}`, {
              defaultValue: change.field,
            })
          : '',
        by,
        from: change.oldValue ?? empty,
        to: change.newValue ?? empty,
      });
    }
  }
};

// Spec 0051 (AC-7): "Changes by the co-op", the rider's own account record, newest first. Read on each
// visit, never saved on the phone (it is not in the persisted queries).
export const AccountChanges = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ['accountChanges'],
    queryFn: fetchAccountChanges,
    gcTime: 0,
  });
  const changes = query.data ?? [];
  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('translations:account_changes')}</Text>
        </View>
        <FlatList
          data={changes}
          keyExtractor={change => change.id}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isLoading}
              onRefresh={() => query.refetch()}
            />
          }
          ListEmptyComponent={
            query.isLoading ? null : (
              <Text style={styles.textInfo}>
                {query.isError
                  ? t('translations:account_changes_failed')
                  : t('translations:account_changes_none')}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.textField} testID={`account-change-${item.id}`}>
              <Text style={styles.textInfo}>
                {coopDate(Date.parse(item.createdAt))}{' '}
                {coopClock(Date.parse(item.createdAt))}
              </Text>
              <Text style={styles.line}>{accountChangeLine(item, t)}</Text>
              {item.reason ? (
                <Text style={styles.textInfo}>
                  {t('translations:account_change_reason', {
                    reason: item.reason,
                  })}
                </Text>
              ) : null}
            </View>
          )}
        />
      </ScreenSafeArea>
    </View>
  );
};
