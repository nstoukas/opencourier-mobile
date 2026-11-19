import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
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
        {/* Spec 0015, AC-15: paid although it was cancelled, so say so. */}
        {item.kind === 'CANCELLATION_COMPENSATION' && (
          <Text style={styles.cellAddress}>
            {t('translations:earnings_cancelled_job')}
          </Text>
        )}
        {/* Spec 0033, AC-5: paid for waiting at the restaurant. */}
        {item.kind === 'WAITING' && (
          <Text style={styles.cellAddress}>
            {t('translations:earnings_waiting')}
          </Text>
        )}
        {/* Spec 0035, AC-17: paid for coming off an order, and for taking the food back. */}
        {item.kind === 'REMOVAL_COMPENSATION' && (
          <Text style={styles.cellAddress}>
            {t('translations:earnings_removal')}
          </Text>
        )}
        {/* Row 112 review: paid when the job went to another rider. */}
        {item.kind === 'REASSIGNMENT_COMPENSATION' && (
          <Text style={styles.cellAddress}>
            {t('translations:earnings_reassigned_job')}
          </Text>
        )}
        {item.kind === 'RETURN_TRIP' && (
          <Text style={styles.cellAddress}>
            {t('translations:earnings_return_trip')}
          </Text>
        )}
        {/* Spec 0038 (AC-7): pay a person added when answering a review request. */}
        {item.kind === 'REVIEW_CORRECTION' && (
          <Text style={styles.cellAddress}>
            {t('translations:earnings_review_correction')}
          </Text>
        )}
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
      <ScreenSafeArea style={styles.safe}>
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
            {/* Row 112: a day of pay with no drop off says so, never "0 deliveries" alone. */}
            {deliveryCount === 0 && total > 0
              ? t('translations:earnings_paid_without_deliveries')
              : deliveryCount === 1
              ? `1 ${t('translations:delivery_small')}`
              : `${deliveryCount} ${t('translations:deliveries_small')}`}
          </Text>
          {(deliveryCount > 0 || total > 0) && (
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
            // One order can pay several times in a day, even twice of one kind (spec 0035): one row each.
            // The index keeps those apart, and is safe because this list is never reordered.
            keyExtractor={(item, index) =>
              `${item.deliveryId}-${item.kind ?? 'delivery'}-${index}`
            }
            data={deliveries}
            renderItem={renderItem}
            ListEmptyComponent={renderEmpty}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
            }
          />
        )}
      </ScreenSafeArea>
    </View>
  );
};
