import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import moment from 'moment';
import { styles } from './EarningsDelivery.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import LinearGradient from 'react-native-linear-gradient';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@app/styles/colors';
import { useTranslation } from 'react-i18next';
import { detailFailureOf, useEarningsDelivery } from '@app/hooks/useEarnings';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { Button, ButtonType } from '@app/components/Button/Button';
import { REASON_KEYS } from '@app/components/TimeWorkedSection/TimeWorkedSection';
import { EarningsTimelineLine } from '@app/types/earnings';
import {
  END_LABEL_KEYS,
  asOfLabel,
  formatKm,
  waitMinutes,
} from '@app/utilities/earnings';
import { coopClock, coopDate } from '@app/utilities/timeWorked';

type Props = MainScreenProp<MainScreens.EarningsDelivery>;

// Spec 0042 (AC-10, AC-11): one delivery as this rider held it. The pay breakdown, line by line in
// cents from the records, adds up to the total; the timeline shows what happened, in fixed words, with
// who acted only as "You", "Restaurant", "Dispatch" or "System". Never another rider, the customer, an
// amount on the timeline, or an event's own message: the server sends none of them.

/** One label/value line. Separators sit between rows, never above the first one. */
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

const clock = (iso: string) => coopClock(Date.parse(iso));
const day = (iso: string) =>
  moment(coopDate(Date.parse(iso)), 'YYYY-MM-DD').format('D MMM');

// Decision 75.18: a label per event type in the translations; a type with none (a new one) reads
// "Update" rather than breaking the screen. `showDay` puts the day before the time when this line falls
// on another day than the line before it (a review or a payment can come days after the job).
const TimelineRow = ({
  line,
  showDay,
}: {
  line: EarningsTimelineLine;
  showDay: boolean;
}) => {
  const { t } = useTranslation();
  const what = line.anotherRider
    ? t('translations:earnings_event_another_rider')
    : t(`translations:earnings_event_${line.type}`, {
        defaultValue: t('translations:earnings_event_update'),
      });
  return (
    <View style={styles.timelineLine} testID="earnings-timeline-line">
      <Text style={styles.timelineTime}>
        {showDay ? `${day(line.at)}, ${clock(line.at)}` : clock(line.at)}
      </Text>
      <Text style={styles.timelineText}>
        {line.who
          ? t('translations:earnings_event_by', {
              what,
              who: t(`translations:earnings_who_${line.who}`),
            })
          : what}
      </Text>
    </View>
  );
};

export const EarningsDelivery = ({ navigation, route }: Props) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const { deliveryId } = route.params;
  const {
    data,
    error,
    isLoading,
    isError,
    failureCount,
    failureReason,
    refetch,
    dataUpdatedAt,
  } = useEarningsDelivery(deliveryId);
  // Only the rider's own pull shows the spinner; background refetches and retries do not.
  const [pulling, setPulling] = useState(false);
  const onRefresh = () => {
    setPulling(true);
    refetch().finally(() => setPulling(false));
  };

  const body = () => {
    if (isLoading) {
      return <ActivityIndicator />;
    }

    // A failed refetch over data already loaded keeps showing it, with how old it is (AC-13). With no
    // data, say why: no signal and never opened on this phone, not this rider's job (a 404), or any
    // other answer from the server.
    if (!data) {
      const failure = detailFailureOf(error);
      const [title, subtitle] =
        failure === 'noConnection'
          ? ['earnings_no_connection', 'earnings_detail_needs_connection']
          : failure === 'notFound'
          ? ['delivery_not_found', 'earnings_detail_not_found']
          : ['earnings_detail_could_not_load', 'earnings_pull_to_retry'];
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t(`translations:${title}`)}</Text>
          <Text style={styles.emptySubtitle}>
            {t(`translations:${subtitle}`)}
          </Text>
        </View>
      );
    }

    const money = (cents: number) =>
      formatCurrencyFromCents(cents, data.currencyCode);
    const { breakdown } = data;
    const firstJob = data.jobs[0];

    return (
      <>
        {/* The note shows from the first failed try, not after every retry (`failureCount`); "No
            connection" only when the server never answered (AC-13). */}
        {(isError || failureCount > 0) && (
          <Text style={styles.note} testID="earnings-as-of">
            {t(
              detailFailureOf(error ?? failureReason) === 'noConnection'
                ? 'translations:earnings_as_of'
                : 'translations:earnings_refresh_failed_as_of',
              { time: asOfLabel(dataUpdatedAt) },
            )}
          </Text>
        )}
        <View style={styles.card}>
          <Text style={styles.total}>{money(breakdown.totalCents)}</Text>
          <Text style={styles.totalLabel}>
            {t('translations:total_earned')}
          </Text>
        </View>

        <View style={styles.card} testID="earnings-breakdown">
          {breakdown.baseFeeCents !== null &&
          breakdown.distanceFeeCents !== null ? (
            <>
              <DetailRow
                label={t('translations:earnings_base_fee')}
                value={money(breakdown.baseFeeCents)}
                first
              />
              <DetailRow
                label={t('translations:earnings_distance_fee')}
                value={money(breakdown.distanceFeeCents)}
              />
            </>
          ) : (
            <DetailRow
              label={t('translations:earnings_delivery_pay')}
              value={money(breakdown.deliveryPayCents)}
              first
            />
          )}
          <DetailRow
            label={t('translations:tips')}
            value={money(breakdown.tipsCents)}
          />
          {breakdown.compensations.map((c, index) => {
            const reason = REASON_KEYS[c.reason]
              ? t(`translations:${REASON_KEYS[c.reason]}`)
              : c.reason;
            const withMinutes =
              c.waitMinutes !== null
                ? t('translations:earnings_reason_minutes', {
                    reason,
                    minutes: c.waitMinutes,
                  })
                : reason;
            return (
              <DetailRow
                key={`${c.reason}-${c.createdAt}-${index}`}
                label={
                  c.addedLater
                    ? t('translations:earnings_added_later', {
                        what: withMinutes,
                        day: day(c.createdAt),
                      })
                    : withMinutes
                }
                value={money(c.amountCents)}
              />
            );
          })}
          <DetailRow
            label={t('translations:earnings_total')}
            value={money(breakdown.totalCents)}
            strong
          />
        </View>

        <View style={styles.card}>
          <DetailRow
            label={t('translations:picked_up_from')}
            value={data.pickupName}
            first
          />
          <DetailRow
            label={t('translations:earnings_dropoff_area')}
            value={data.dropoffArea ?? '—'}
          />
          <DetailRow
            label={t('translations:earnings_paid_km')}
            value={formatKm(data.paidKm)}
          />
          {data.jobs.map(job => (
            <DetailRow
              key={job.acceptedAt}
              label={t('translations:earnings_your_job', {
                day: day(job.acceptedAt),
                time: clock(job.acceptedAt),
              })}
              value={[
                t('translations:earnings_minutes', { minutes: job.minutes }),
                job.pickupWaitSeconds === null
                  ? null
                  : t('translations:earnings_job_wait', {
                      minutes: waitMinutes(job.pickupWaitSeconds),
                    }),
                job.endLabel
                  ? t(`translations:${END_LABEL_KEYS[job.endLabel]}`)
                  : t('translations:earnings_end_delivered'),
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
          <View style={styles.rowSeparator} />
          <View style={styles.idRow}>
            <Text style={styles.rowLabel}>{t('translations:delivery_id')}</Text>
            {/* selectable lets a rider copy the id when raising it with the co-op. */}
            <Text style={styles.idValue} selectable>
              {data.deliveryId}
            </Text>
          </View>
        </View>

        <View style={styles.card} testID="earnings-timeline">
          <Text style={styles.cardTitle} accessibilityRole="header">
            {t('translations:earnings_timeline')}
          </Text>
          {data.timeline.map((line, index) => {
            // The first line shows its day when it is not the first job's accept day.
            const before = data.timeline[index - 1]?.at ?? firstJob?.acceptedAt;
            const showDay =
              !!before &&
              coopDate(Date.parse(line.at)) !== coopDate(Date.parse(before));
            return (
              <TimelineRow
                key={`${line.at}-${line.type}-${index}`}
                line={line}
                showDay={showDay}
              />
            );
          })}
        </View>

        {/* Spec 0038 (AC-1), kept by spec 0042 (AC-10): ask a person to look again at this delivery. */}
        <View style={styles.card}>
          <Text style={styles.rowLabel}>
            {t('translations:review_from_delivery_hint')}
          </Text>
          <View style={styles.reviewButton}>
            <Button
              type={ButtonType.gray}
              title={t('translations:review_ask')}
              onPress={() =>
                navigation.navigate(MainScreens.RequestReview, {
                  deliveryId: data.deliveryId,
                  deliveryLabel: firstJob
                    ? `${data.pickupName}, ${day(firstJob.acceptedAt)}`
                    : data.pickupName,
                })
              }
            />
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
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('translations:delivery_details')}</Text>
        </View>
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={pulling} onRefresh={onRefresh} />
          }>
          {body()}
        </ScrollView>
      </ScreenSafeArea>
    </View>
  );
};
