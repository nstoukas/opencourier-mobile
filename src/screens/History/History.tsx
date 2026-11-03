import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { HistoryCell } from '@app/components/HistoryCell/HistoryCell';
import { HomeEmptyStateComponent } from '@app/components/HomeEmptyState/HomeEmptyState';
import { SkeletonOrderHistoryCell } from '@app/components/SkeletonOrderHistoryCell/SkeletonOrderHistoryCell';
import { ReportAnIncident } from '@app/components/ReportAnIncident/ReportAnIncident';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { HomeEmptyState } from '@app/types/types';
import { DrawerScreenProp, DrawerScreens } from '@app/navigation/drawer/types';
import { color, space, typeScale } from '@app/styles/theme';

type Props = DrawerScreenProp<DrawerScreens.History>;

// Spec 0018 (AC-13): the delivery history that used to be home's third tab,
// unchanged (the same query, rows and empty state), until row 75 replaces it.
export const HistoryScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [reportIncidentDismissed, setReportIncidentDismissed] = useState(false);
  const {
    data: history,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryFn: services.orderService.getOrdersHistory,
    queryKey: [QueryKeys.orderHistory],
  });
  const orders = history ?? [];

  return (
    <View style={styles.container} testID="history-screen">
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.toggleDrawer()} />
          <Text style={styles.title}>{t('translations:history')}</Text>
        </View>
        {!reportIncidentDismissed && (
          <ReportAnIncident
            onDismiss={() => setReportIncidentDismissed(true)}
          />
        )}
        <FlatList
          keyExtractor={item => item.id}
          data={orders}
          renderItem={({ item }) => (
            <HistoryCell order={item} onPress={() => undefined} />
          )}
          ListEmptyComponent={
            isLoading ? (
              <>
                <SkeletonOrderHistoryCell />
                <SkeletonOrderHistoryCell />
                <SkeletonOrderHistoryCell />
              </>
            ) : (
              <HomeEmptyStateComponent state={HomeEmptyState.History} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
            />
          }
        />
      </ScreenSafeArea>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  safe: {
    flex: 1,
    marginHorizontal: space['4'],
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space['4'],
  },
  title: {
    ...typeScale.h1,
    color: color.foreground,
    marginLeft: space['4'],
  },
});
