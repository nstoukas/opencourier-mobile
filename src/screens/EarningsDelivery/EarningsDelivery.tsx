import React from 'react';
import {
  View,
  SafeAreaView,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import moment from 'moment';
import { styles } from './EarningsDelivery.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import LinearGradient from 'react-native-linear-gradient';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@app/styles/colors';
import { useTranslation } from 'react-i18next';
import { useEarningsDelivery } from '@app/hooks/useEarningsDelivery';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { formatShift, formatSpaced } from '@app/utilities/dates';

type Props = MainScreenProp<MainScreens.EarningsDelivery>;

/** One label/value line in the breakdown. Separators sit between rows, never above the
 *  first one, so a card doesn't open with a stray hairline. */
const DetailRow = ({
  label,
  value,
  strong,
  first,
}: {
  label: string;
  value: string;
  strong?: boolean;
  first?: boolean;
}) => (
  <>
    {!first && <View style={styles.rowSeparator} />}
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>
        {value}
      </Text>
    </View>
  </>
);

export const EarningsDelivery = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const { deliveryId } = route.params;

  const { delivery, isLoading, isError, isRefetching, refetch } =
    useEarningsDelivery(deliveryId);

  const body = () => {
    if (isLoading) {
      return <ActivityIndicator />;
    }

    // A 404 here means the delivery is not this courier's or never completed — the
    // backend deliberately does not distinguish the two, so neither do we.
    if (isError || !delivery) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {t('translations:delivery_not_found')}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('translations:delivery_not_found_subtitle')}
          </Text>
        </View>
      );
    }

    const currency = delivery.currency;
    const droppedOff = moment(delivery.droppedOffAt);

    return (
      <>
        <View style={styles.card}>
          <Text style={styles.total}>
            {formatCurrencyFromCents(delivery.total, currency)}
          </Text>
          <Text style={styles.totalLabel}>
            {t('translations:total_earned')}
          </Text>
        </View>

        <View style={styles.card}>
          <DetailRow
            label={t('translations:piece_rate_pay')}
            value={formatCurrencyFromCents(delivery.compensation, currency)}
            strong
            first
          />
          <DetailRow
            label={t('translations:tips')}
            value={formatCurrencyFromCents(delivery.tips, currency)}
            strong
          />
        </View>

        <View style={styles.card}>
          <DetailRow
            label={t('translations:picked_up_from')}
            value={delivery.pickupBusinessName}
            first
          />
          <DetailRow
            label={t('translations:delivered_to')}
            value={delivery.dropoffAddress ?? t('translations:address_unknown')}
          />
          <DetailRow
            label={t('translations:delivered_on')}
            value={`${droppedOff.format(formatSpaced)}, ${droppedOff.format(
              formatShift,
            )}`}
          />
          <View style={styles.rowSeparator} />
          <View style={styles.idRow}>
            <Text style={styles.rowLabel}>{t('translations:delivery_id')}</Text>
            {/* selectable lets a courier copy the id when raising it with the co-op. */}
            <Text style={styles.idValue} selectable>
              {delivery.deliveryId}
            </Text>
          </View>
        </View>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        style={[styles.gradient, { height: top + 100 }]}
        colors={Colors.offlineGradientArray}
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('translations:delivery_details')}</Text>
        </View>
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }>
          {body()}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};
