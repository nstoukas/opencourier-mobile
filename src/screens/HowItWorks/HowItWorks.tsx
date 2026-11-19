import React, { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Button, ButtonType } from '@app/components/Button/Button';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { Colors } from '@app/styles/colors';
import {
  useHowItWorks,
  useReviewRequests,
  useSettingChanges,
  useWithdrawReviewRequest,
} from '@app/hooks/useReviewRequests';
import { markReviewsSeen, useReviewSeen } from '@app/services/reviewSeen';
import { clearReviewNotice } from '@app/services/reviewNotice';
import { ReviewRequest } from '@app/types/types';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { formatShift, formatSpaced } from '@app/utilities/dates';
import { styles } from './HowItWorks.styles';

type Props = MainScreenProp<MainScreens.HowItWorks>;

const TOPIC_LABEL = {
  OFFER: 'translations:review_topic_offer',
  PAY: 'translations:review_topic_pay',
  OTHER: 'translations:review_topic_other',
} as const;

const dayAndTime = (iso: string) =>
  `${moment(iso).format(formatSpaced)}, ${moment(iso).format(formatShift)}`;

// Spec 0038 (AC-11, AC-8, AC-13): how offers reach the rider and how pay is worked out, in plain
// sentences the server builds from the settings in effect now; what a person decides; what the app
// records; the rider's review requests with their answers; and what changed in the rules.
export const HowItWorks = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const howItWorks = useHowItWorks();
  const requests = useReviewRequests();
  const changes = useSettingChanges();
  const { confirmWithdraw, isPending: withdrawing } =
    useWithdrawReviewRequest();
  const seen = useReviewSeen();

  const allRequests = requests.data?.pages.flatMap(page => page.data) ?? [];
  const allChanges = changes.data?.pages.flatMap(page => page.data) ?? [];

  // An answer stays marked "New" while the rider is on this page, and counts as opened once they
  // leave it. The marks live on this phone only (AC-9).
  const answeredNow = useRef<string[]>([]);
  answeredNow.current = allRequests
    .filter(request => request.status === 'ANSWERED')
    .map(request => request.id);
  useFocusEffect(
    useCallback(() => {
      // The rider is reading the answers now, so the notice about them leaves the shade.
      clearReviewNotice();
      return () => {
        markReviewsSeen(answeredNow.current).catch(() => undefined);
      };
    }, []),
  );

  const refreshing =
    howItWorks.isRefetching || requests.isRefetching || changes.isRefetching;
  const refresh = () => {
    howItWorks.refetch();
    requests.refetch();
    changes.refetch();
  };

  const section = (title: string, lines: string[] | undefined) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle} accessibilityRole="header">
        {title}
      </Text>
      {lines ? (
        lines.map(line => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))
      ) : howItWorks.isError ? (
        <Text style={styles.muted}>{t('translations:how_failed')}</Text>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );

  const renderRequest = (request: ReviewRequest) => {
    const isNew = request.status === 'ANSWERED' && !seen.includes(request.id);
    return (
      <View
        key={request.id}
        style={styles.item}
        testID={`review-${request.id}`}>
        <View style={styles.itemHead}>
          <Text style={styles.itemTitle}>
            {t(TOPIC_LABEL[request.topic])}
            {', '}
            {request.delivery
              ? request.delivery.pickupName
              : t('translations:review_general')}
          </Text>
          {isNew ? (
            <Text style={styles.newDot}>
              {t('translations:review_new_answer')}
            </Text>
          ) : null}
        </View>
        <Text style={styles.muted}>
          {t('translations:review_sent_on', {
            when: dayAndTime(request.createdAt),
          })}
        </Text>
        <Text style={styles.line} numberOfLines={3}>
          {request.note}
        </Text>
        {request.status === 'OPEN' ? (
          <>
            {request.overdue ? (
              <Text style={styles.overdue}>
                {t('translations:review_overdue')}
              </Text>
            ) : (
              <Text style={styles.muted}>
                {t('translations:review_due', {
                  when: dayAndTime(request.dueAt),
                })}
              </Text>
            )}
            <View style={styles.buttonGap}>
              <Button
                type={ButtonType.gray}
                title={t('translations:review_withdraw')}
                disabled={withdrawing}
                onPress={() => confirmWithdraw(request.id)}
              />
            </View>
          </>
        ) : null}
        {request.status === 'ANSWERED' ? (
          <View style={styles.answer}>
            <Text style={styles.answerTitle}>
              {t(
                request.outcome === 'CHANGED'
                  ? 'translations:review_outcome_changed'
                  : 'translations:review_outcome_stands',
              )}
            </Text>
            {request.answer ? (
              <Text style={styles.line}>{request.answer}</Text>
            ) : null}
            {request.correctionCents != null ? (
              <Text style={styles.answerTitle}>
                {t('translations:review_correction', {
                  amount: formatCurrencyFromCents(
                    request.correctionCents,
                    request.correctionCurrency ?? 'EUR',
                  ),
                })}
              </Text>
            ) : null}
            {request.answeredAt ? (
              <Text style={styles.muted}>
                {t('translations:review_answered_on', {
                  when: dayAndTime(request.answeredAt),
                })}
              </Text>
            ) : null}
          </View>
        ) : null}
        {request.status === 'WITHDRAWN' ? (
          <Text style={styles.muted}>{t('translations:review_withdrawn')}</Text>
        ) : null}
      </View>
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
          <Text style={styles.title}>{t('translations:how_title')}</Text>
        </View>
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }>
          {/* Shown with the last numbers loaded when they could not be loaded again (AC-11). */}
          {howItWorks.isError && howItWorks.data ? (
            <Text style={styles.muted}>
              {t('translations:how_maybe_stale')}
            </Text>
          ) : null}
          {section(t('translations:how_offers'), howItWorks.data?.offers)}
          {section(t('translations:how_pay'), howItWorks.data?.pay)}
          {section(
            t('translations:how_person_decides'),
            howItWorks.data?.personDecides,
          )}
          {section(
            t('translations:how_app_records'),
            howItWorks.data?.appRecords,
          )}
          {/* Spec 0040 (AC-13): how time worked is counted, and that admins can see it. */}
          {section(
            t('translations:how_time_worked'),
            howItWorks.data?.timeWorked,
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              {t('translations:how_ask_review')}
            </Text>
            <Text style={styles.line}>
              {howItWorks.data
                ? t('translations:how_ask_review_body', {
                    days: howItWorks.data.reviewAnswerDays,
                  })
                : t('translations:how_ask_review_body_plain')}
            </Text>
            <Button
              type={ButtonType.redBGRedText}
              title={t('translations:review_ask')}
              onPress={() => navigation.navigate(MainScreens.RequestReview, {})}
            />
            {requests.isError && allRequests.length === 0 ? (
              <Text style={[styles.muted, styles.buttonGap]}>
                {t('translations:review_list_failed')}
              </Text>
            ) : null}
            {allRequests.map(renderRequest)}
            {requests.hasNextPage ? (
              <TouchableOpacity
                style={styles.more}
                onPress={() => requests.fetchNextPage()}
                accessibilityRole="button">
                <Text style={styles.moreText}>
                  {t('translations:show_older')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              {t('translations:how_what_changed')}
            </Text>
            {allChanges.length === 0 ? (
              <Text style={styles.muted}>
                {changes.isError
                  ? t('translations:how_changes_failed')
                  : changes.isLoading
                  ? ''
                  : t('translations:how_no_changes')}
              </Text>
            ) : null}
            {allChanges.map((change, index) => (
              <View key={`${change.at}-${index}`} style={styles.item}>
                <Text style={styles.itemTitle}>{change.label}</Text>
                <Text style={styles.line}>
                  {t('translations:how_change_line', {
                    from: change.oldText,
                    to: change.newText,
                  })}
                </Text>
                <Text style={styles.muted}>
                  {t('translations:how_change_by', {
                    when: dayAndTime(change.at),
                  })}
                </Text>
              </View>
            ))}
            {changes.hasNextPage ? (
              <TouchableOpacity
                style={styles.more}
                onPress={() => changes.fetchNextPage()}
                accessibilityRole="button">
                <Text style={styles.moreText}>
                  {t('translations:show_older')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </ScreenSafeArea>
    </View>
  );
};
