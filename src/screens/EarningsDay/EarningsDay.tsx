import React from 'react';
import {
  View,
  SafeAreaView,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import moment from 'moment';
import { styles } from './EarningsDay.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import LinearGradient from 'react-native-linear-gradient';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@app/styles/colors';
import { useTranslation } from 'react-i18next';
import { useEarningsDay } from '@app/hooks/useEarningsDay';
import { EarningsDelivery } from '@app/types/types';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { formatApiDate, formatSpaced, formatShift } from '@app/utilities/dates';

type Props = MainScreenProp<MainScreens.EarningsDay>;

export const EarningsDay = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const { date } = route.params;

  const {
    deliveries,
    deliveryCount,
    compensation,
    tips,
    total,
    currency,
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useEarningsDay(date);

  const renderItem = ({ item }: { item: EarningsDelivery }) => (
    <TouchableOpacity
      style={styles.cell}
      onPress={() =>
        navigation.navigate(MainScreens.EarningsDelivery, {
          deliveryId: item.deliveryId,
        })
      }>
      <View style={styles.cellText}>
        <Text style={styles.cellStore}>{item.pickupBusinessName}</Text>
        {/* The address can legitimately be null when the location was never geocoded. */}
        {item.dropoffAddress && (
          <Text style={styles.cellAddress} numberOfLines={1}>
            {item.dropoffAddress}
          </Text>
        )}
        <Text style={styles.cellTime}>
          {moment(item.droppedOffAt).format(formatShift)}
        </Text>
      </View>
      <View style={styles.cellAmount}>
        <Text style={styles.cellTotal}>
          {formatCurrencyFromCents(item.total, currency)}
        </Text>
        {item.tips > 0 && (
          <Text style={styles.cellTips}>
            {t('translations:includes_tips', {
              tips: formatCurrencyFromCents(item.tips, currency),
            })}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>
        {isError
          ? t('translations:earnings_load_failed')
          : t('translations:no_earnings')}
      </Text>
      <Text style={styles.emptySubtitle}>
        {isError
          ? t('translations:earnings_load_failed_subtitle')
          : t('translations:no_orders_made_yet')}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        style={[styles.gradient, { height: top + 100 }]}
        colors={Colors.offlineGradientArray}
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>
            {moment(date, formatApiDate).format(formatSpaced)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTotal}>
            {formatCurrencyFromCents(total, currency)}
          </Text>
          <Text style={styles.summaryCount}>
            {deliveryCount === 1
              ? `1 ${t('translations:delivery_small')}`
              : `${deliveryCount} ${t('translations:deliveries_small')}`}
          </Text>
          {deliveryCount > 0 && (
            <Text style={styles.summaryBreakdown}>
              {t('translations:pay_tips_breakdown', {
                pay: formatCurrencyFromCents(compensation, currency),
                tips: formatCurrencyFromCents(tips, currency),
              })}
            </Text>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            keyExtractor={item => item.deliveryId}
            data={deliveries}
            renderItem={renderItem}
            ListEmptyComponent={renderEmpty}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
};
