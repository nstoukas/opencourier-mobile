import React, { useMemo, useState } from 'react';
import {
  View,
  SafeAreaView,
  Text,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { styles } from './Earnings.styles';
import { DrawerScreenProp, DrawerScreens } from '@app/navigation/drawer/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import LinearGradient from 'react-native-linear-gradient';
import { Colors } from '@app/styles/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cashout } from '@app/components/CashOut/Cashout';
import { EarningsTabs } from '@app/components/EarningsTabs/EarningsTabs';
import { EarningsSummaryDay, EarningsTabItem } from '@app/types/types';
import { WeekSelector } from '@app/components/WeekSelector/WeekSelector';
import { EarningsCell } from '@app/components/EarningsCell/EarningsCell';
import moment, { Moment } from 'moment';
import { CELL_EARNINGS_EMPTY } from '@app/utilities/constants';
import { Images } from '@app/utilities/images';
import { Button, ButtonType } from '@app/components/Button/Button';
import {
  formatApiDate,
  startOfThisWeek,
  endOfThisWeek,
} from '@app/utilities/dates';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { MainScreens } from '@app/navigation/main/types';
import { useTranslation } from 'react-i18next';
import { useEarnings } from '@app/hooks/useEarnings';

type Props = DrawerScreenProp<DrawerScreens.Earnings>;

type DataSourceType = EarningsSummaryDay | string;

export const Earnings = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState<EarningsTabItem>(
    EarningsTabItem.Today,
  );
  // The week the WeekSelector is pointing at, kept as plain 'YYYY-MM-DD' strings so the
  // query key below only changes when the week really changes.
  const [week, setWeek] = useState({
    start: startOfThisWeek().format(formatApiDate),
    end: endOfThisWeek().format(formatApiDate),
  });
  const { top } = useSafeAreaInsets();

  const {
    days,
    totalEarnings,
    totalCompensation,
    totalTips,
    deliveryCount,
    currency,
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useEarnings(selectedTab, week);

  // A day row per entry, or the single sentinel string that renders the empty state.
  const dataSource: DataSourceType[] = useMemo(
    () => (days.length > 0 ? days : [CELL_EARNINGS_EMPTY]),
    [days],
  );

  const emptyCell = () => {
    if (isError) {
      return (
        <View style={styles.containerEmptyCell}>
          <Image source={Images.Car} />
          <Text style={styles.textEmptyCellTitle}>
            {t('translations:earnings_load_failed')}
          </Text>
          <Text style={styles.textEmptyCellSubtitle}>
            {t('translations:earnings_load_failed_subtitle')}
          </Text>
        </View>
      );
    }

    const title = () => {
      switch (selectedTab) {
        case EarningsTabItem.Today:
          return t('translations:no_earnings_today');
        case EarningsTabItem.Weekly:
          return t('translations:no_weekly_earnings');
        case EarningsTabItem.All:
          return t('translations:no_earnings');
      }
    };

    const subtitle = () => {
      switch (selectedTab) {
        case EarningsTabItem.Today:
          return t('translations:no_orders_made_today');
        case EarningsTabItem.Weekly:
          return t('translations:no_orders_made_this_week');
        case EarningsTabItem.All:
          return t('translations:no_orders_made_yet');
      }
    };

    return (
      <View style={styles.containerEmptyCell}>
        <Image source={Images.Car} />
        <Text style={styles.textEmptyCellTitle}>{title()}</Text>
        <Text style={styles.textEmptyCellSubtitle}>{subtitle()}</Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (selectedTab !== EarningsTabItem.Weekly) {
      // FlatList's ListFooterComponent types reject undefined, so return null.
      return null;
    }

    return (
      <View style={styles.footer}>
        <View style={styles.footerSeparator} />
        <Button
          style={styles.buttonFooter}
          title={t('translations:download_weekly_summary')}
          onPress={() => undefined}
          type={ButtonType.white}
        />
        <Button
          title={t('translations:see_payout_history')}
          onPress={() => navigation.navigate(MainScreens.PayoutActivity)}
          type={ButtonType.white}
        />
      </View>
    );
  };

  const renderItem = ({ item }: { item: DataSourceType }) => {
    if (typeof item === 'string') {
      return emptyCell();
    }

    return (
      <EarningsCell
        date={moment(item.date, formatApiDate)}
        earned={item.total}
        currency={currency}
        detail={`${item.deliveryCount} ${
          item.deliveryCount === 1
            ? t('translations:delivery_small')
            : t('translations:deliveries_small')
        }`}
        onPress={() =>
          navigation.navigate(MainScreens.EarningsDay, { date: item.date })
        }
      />
    );
  };

  const headerTitle = useMemo(() => {
    if (deliveryCount > 0) {
      return `${deliveryCount} ${t('translations:orders_small')}`;
    }
    switch (selectedTab) {
      case EarningsTabItem.Today:
        return t('translations:no_orders_today');
      case EarningsTabItem.Weekly:
        return t('translations:no_orders_this_week');
      case EarningsTabItem.All:
        return t('translations:no_orders');
    }
  }, [selectedTab, deliveryCount]);

  const handleWeekChange = (start: Moment, end: Moment) => {
    setWeek({
      start: start.format(formatApiDate),
      end: end.format(formatApiDate),
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        style={[styles.gradient, { height: top + 100 }]}
        colors={Colors.offlineGradientArray}
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.toggleDrawer()} />
          <Text style={styles.title}>{t('translations:earnings')}</Text>
        </View>
        <View style={styles.containerEarnings}>
          <View style={styles.earningsText}>
            <Text style={styles.textEarned}>
              {formatCurrencyFromCents(totalEarnings, currency)}
            </Text>
            <Text style={styles.textCount}>{headerTitle}</Text>
            {deliveryCount > 0 && (
              // Piece-rate pay and tips are different things: pay is what the co-op owes
              // for the work, tips are the customer's. Showing only the sum would let a
              // good tips week hide a bad rate, so the split is always visible.
              <Text style={styles.textBreakdown}>
                {t('translations:pay_tips_breakdown', {
                  pay: formatCurrencyFromCents(totalCompensation, currency),
                  tips: formatCurrencyFromCents(totalTips, currency),
                })}
              </Text>
            )}
          </View>
          <Cashout onPress={() => undefined} />
        </View>
        <EarningsTabs
          style={styles.topMargin}
          selectedTab={selectedTab}
          onTabSelected={setSelectedTab}
        />
        <WeekSelector
          onWeekRangeChange={handleWeekChange}
          type={selectedTab}
          earned={totalEarnings}
          currency={currency}
          style={styles.veticalMargin}
        />
        {isLoading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            keyExtractor={item => (typeof item === 'string' ? item : item.date)}
            data={dataSource}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListFooterComponent={renderFooter}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
};
