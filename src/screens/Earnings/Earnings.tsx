import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Icon } from '@app/components/Icon/Icon';
import { MonthCalendar } from '@app/components/MonthCalendar/MonthCalendar';
import {
  CoopWeekCard,
  ShiftRow,
} from '@app/components/TimeWorkedSection/TimeWorkedSection';
import { DrawerScreenProp, DrawerScreens } from '@app/navigation/drawer/types';
import { MainScreens } from '@app/navigation/main/types';
import { Colors } from '@app/styles/colors';
import {
  detailFailureOf,
  useEarningsMonth,
  useEarningsMonths,
} from '@app/hooks/useEarnings';
import { useCoopTotals } from '@app/hooks/useTimeWorked';
import { useReviewRequests } from '@app/hooks/useReviewRequests';
import { queryClient } from '@app/services/queryClient';
import { useReviewSeen } from '@app/services/reviewSeen';
import {
  EarningsFigures,
  EarningsJob,
  EarningsMonth,
  EarningsShift,
} from '@app/types/earnings';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import {
  END_LABEL_KEYS,
  EarningsMode,
  asOfLabel,
  MergedMonths,
  formatKm,
  jobDate,
  jobMinutes,
  jobMoneyCents,
  mergeMonths,
  monthOf,
  noShiftJobOn,
  monthsOfPeriod,
  periodDates,
  shiftsOnDay,
  waitMinutes,
  weekStartOf,
} from '@app/utilities/earnings';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  addDays,
  coopClock,
  coopDate,
  formatWorkDuration,
} from '@app/utilities/timeWorked';
import { styles } from './Earnings.styles';
import { StatementsSection } from '@app/components/StatementsSection/StatementsSection';

type Props = DrawerScreenProp<DrawerScreens.Earnings>;

// Spec 0042: one Earnings screen in place of Earnings, Earnings day, the old delivery screen and History
// (AC-6). The rider picks a day or a week; the screen shows that period's four figures (AC-1), the co-op
// card (spec 0040 AC-12), and the period's jobs under their shift headers (AC-8). Every figure and rate
// comes from the server; the phone picks which days, shifts and jobs to show, and adds up only a row's
// own minutes and money from that job's own numbers.

const dayLabel = (date: string) =>
  moment(date, 'YYYY-MM-DD').format('ddd D MMM');

// One figure of the grid, "—" when there is nothing to divide by (AC-1).
const Figure = ({
  value,
  label,
  testID,
}: {
  value: string;
  label: string;
  testID: string;
}) => (
  <View style={styles.figure} testID={testID}>
    <Text style={styles.figureValue}>{value}</Text>
    <Text style={styles.figureLabel}>{label}</Text>
  </View>
);

const FiguresCard = ({
  figures,
  currencyCode,
  soFar,
  cutFrom,
}: {
  figures: EarningsFigures;
  currencyCode: string;
  soFar: boolean;
  // A week cut at the rider's first reachable day counts from there (AC-5).
  cutFrom: string | null;
}) => {
  const { t } = useTranslation();
  const money = (cents: number) => formatCurrencyFromCents(cents, currencyCode);
  const rate = (cents: number | null) =>
    cents === null
      ? '—'
      : t('translations:time_worked_per_hour', { amount: money(cents) });
  return (
    <View style={styles.card} testID="earnings-figures">
      <Text style={styles.total}>{money(figures.moneyCents)}</Text>
      <Text style={styles.totalNote}>
        {t('translations:earnings_period_note', {
          count: figures.dropOffCount,
          time: formatWorkDuration(figures.workSeconds),
        })}
        {soFar ? ` · ${t('translations:earnings_so_far')}` : ''}
        {cutFrom
          ? ` · ${t('translations:earnings_counted_from', {
              day: moment(cutFrom, 'YYYY-MM-DD').format('D MMM'),
            })}`
          : ''}
      </Text>
      <View style={styles.figureGrid}>
        <Figure
          value={rate(figures.centsPerHour)}
          label={t('translations:earnings_per_hour_worked')}
          testID="figure-per-hour"
        />
        <Figure
          value={rate(figures.activeCentsPerHour)}
          label={t('translations:earnings_per_hour_on_job')}
          testID="figure-per-hour-on-job"
        />
        <Figure
          value={
            figures.centsPerPaidKm === null
              ? '—'
              : t('translations:earnings_per_km', {
                  amount: money(figures.centsPerPaidKm),
                })
          }
          label={t('translations:earnings_per_paid_km')}
          testID="figure-per-km"
        />
        <Figure
          value={
            figures.medianPickupWaitSeconds === null
              ? '—'
              : t('translations:earnings_minutes', {
                  minutes: waitMinutes(figures.medianPickupWaitSeconds),
                })
          }
          label={t('translations:earnings_pickup_wait', {
            count: figures.pickupWaitCount,
          })}
          testID="figure-pickup-wait"
        />
      </View>
      <Text style={styles.muted}>
        {t('translations:time_worked_split', {
          job: formatWorkDuration(figures.jobSeconds),
          wait: formatWorkDuration(figures.paidWaitSeconds),
          unpaid: formatWorkDuration(figures.unpaidSeconds),
        })}
      </Text>
      {figures.noJobMoneyCents > 0 && (
        <Text style={styles.muted}>
          {t('translations:earnings_money_no_job', {
            amount: money(figures.noJobMoneyCents),
          })}
        </Text>
      )}
    </View>
  );
};

// AC-8: accept time, restaurant → drop off area, paid km, minutes, money, and how it ended.
const JobRow = ({
  job,
  currencyCode,
  onPress,
}: {
  job: EarningsJob;
  currencyCode: string;
  onPress: () => void;
}) => {
  const { t } = useTranslation();
  const meta = [
    job.paidKm === null ? '—' : formatKm(job.paidKm),
    t('translations:earnings_minutes', {
      minutes: jobMinutes(job, Date.now()),
    }),
    ...(job.endLabel
      ? [t(`translations:${END_LABEL_KEYS[job.endLabel]}`)]
      : []),
  ].join(' · ');
  return (
    <TouchableOpacity
      style={styles.job}
      onPress={onPress}
      accessibilityRole="button"
      testID="earnings-job">
      <Text style={styles.jobTime}>
        {coopClock(Date.parse(job.acceptedAt))}
      </Text>
      <View style={styles.jobMain}>
        <Text style={styles.jobPlaces} numberOfLines={1}>
          {t('translations:earnings_job_places', {
            from: job.pickupName,
            to: job.dropoffArea ?? '—',
          })}
        </Text>
        <Text style={styles.muted}>{meta}</Text>
      </View>
      <Text style={styles.jobMoney}>
        {formatCurrencyFromCents(jobMoneyCents(job), currencyCode)}
      </Text>
    </TouchableOpacity>
  );
};

// One day's jobs: under each shift that touched the day, then those in no recorded shift (AC-6).
const DayJobs = ({
  date,
  merged,
  onOpenJob,
}: {
  date: string;
  merged: MergedMonths;
  onOpenJob: (job: EarningsJob) => void;
}) => {
  const { t } = useTranslation();
  const shifts: EarningsShift[] = shiftsOnDay(merged.shifts, date, Date.now());
  const loose = merged.jobsInNoShift
    .filter(job => jobDate(job) === date)
    .sort((a, b) => (a.acceptedAt < b.acceptedAt ? -1 : 1));
  if (shifts.length === 0 && loose.length === 0) {
    return (
      <Text style={styles.notice} testID="earnings-no-work">
        {t('translations:earnings_no_work_day')}
      </Text>
    );
  }
  const row = (job: EarningsJob) => (
    <JobRow
      key={`${job.deliveryId}-${job.acceptedAt}`}
      job={job}
      currencyCode={merged.currencyCode}
      onPress={() => onOpenJob(job)}
    />
  );
  return (
    <>
      {shifts.map(shift => {
        const startDay = coopDate(Date.parse(shift.startedAt));
        return (
          <View key={shift.startedAt} style={styles.group}>
            <ShiftRow
              shift={shift}
              continuesFrom={startDay < date ? startDay : undefined}
              style={styles.shiftInGroup}
            />
            {shift.jobs.map(row)}
          </View>
        );
      })}
      {loose.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>
            {t('translations:earnings_not_in_shift')}
          </Text>
          {loose.map(row)}
        </View>
      )}
    </>
  );
};

export const Earnings = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const today = coopDate(Date.now());
  const [mode, setMode] = useState<EarningsMode>('day');
  const [date, setDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(monthOf(today));

  // A week can reach into next month (not started yet), or back into a month wholly before the
  // rider's reach: the server refuses both, so they are never asked for.
  // The newest reach any saved month carries: a month saved yesterday can hold yesterday's reach, which
  // on the 1st of a month would let the screen ask for a month the server now refuses.
  const knownReach = queryClient
    .getQueriesData<EarningsMonth>({ queryKey: [QueryKeys.earningsMonth] })
    .map(([, data]) => data?.reachFrom)
    .filter((reach): reach is string => !!reach)
    .sort()
    .pop();
  const months = monthsOfPeriod(mode, date).filter(
    month =>
      month <= monthOf(today) && (!knownReach || month >= monthOf(knownReach)),
  );
  const queries = useEarningsMonths(months);
  const loaded = queries
    .map(query => query.data)
    .filter((data): data is EarningsMonth => data !== undefined);
  const merged = mergeMonths(loaded);
  const reachFrom = merged.reachFrom ?? knownReach ?? null;
  const isLoading = queries.some(query => query.isLoading);
  // A month whose last try failed, while its saved copy is shown. React Query counts failures from the
  // first try (`failureCount`), so the note shows at once instead of after every retry; `failureReason`
  // is the error of that try. "No connection" only when the server never answered (AC-13).
  const failedOver = queries.filter(
    query => query.data && (query.isError || query.failureCount > 0),
  );
  const offline = failedOver.some(
    query =>
      detailFailureOf(query.error ?? query.failureReason) === 'noConnection',
  );
  const refreshFailed = failedOver.length > 0;
  // With no data at all, why: no signal, or the server answered with an error.
  const failedEmpty = queries.find(query => !query.data && query.isError);
  // The oldest of the saved months shown says how old the screen is (AC-13).
  const asOf = Math.min(
    ...queries.filter(query => query.data).map(query => query.dataUpdatedAt),
  );
  // Only the rider's own pull shows the spinner; background refetches (focus, retries) do not.
  const [pulling, setPulling] = useState(false);

  const calendar = useEarningsMonth(calendarMonth, calendarOpen);
  const marked = useMemo(
    () =>
      new Set(
        (calendar.data?.days ?? [])
          .filter(day => day.workSeconds > 0 || day.moneyCents > 0)
          .map(day => day.date),
      ),
    [calendar.data],
  );
  const coop = useCoopTotals();

  // Drawer screens stay mounted, so the screen keeps the day it was showing. After midnight, a screen
  // that was showing "today" moves to the new today on coming back into view; a day the rider picked on
  // purpose stays. A ref (a value kept between renders that does not cause one) holds the last today.
  const lastToday = useRef(today);

  // Drawer screens stay mounted, so the month, the co-op card and the review answers are read again
  // each time Earnings comes into view (AC-13). An Offline rider gets no push for a review answer.
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        const now = coopDate(Date.now());
        if (now !== lastToday.current) {
          const old = lastToday.current;
          setDate(current => (current === old ? now : current));
          lastToday.current = now;
        }
        [
          QueryKeys.earningsMonth,
          QueryKeys.coopTotals,
          QueryKeys.reviewRequests,
        ].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      }),
    [navigation],
  );

  // Spec 0038: an answered review request this phone has not shown yet.
  const reviewRequests = useReviewRequests();
  const seenAnswers = useReviewSeen();
  const hasNewAnswer = (reviewRequests.data?.pages ?? []).some(page =>
    page.data.some(
      request =>
        request.status === 'ANSWERED' && !seenAnswers.includes(request.id),
    ),
  );

  const dates = periodDates(mode, date);
  const first = dates[0] ?? date;
  const last = dates[dates.length - 1] ?? date;
  const figures =
    mode === 'day'
      ? merged.days.find(day => day.date === date)
      : merged.weeks.find(week => week.weekStart === weekStartOf(date));
  const shownWeek =
    mode === 'week'
      ? merged.weeks.find(week => week.weekStart === weekStartOf(date))
      : undefined;
  const soFar = shownWeek?.soFar === true;
  const cutFrom = shownWeek?.cutAtReach ? reachFrom : null;

  // Back stops at the first day the rider can open, forward at today (AC-9).
  const step = mode === 'day' ? 1 : 7;
  const canGoBack = !reachFrom || addDays(first, -1) >= reachFrom;
  const canGoForward = addDays(first, step) <= today;
  const move = (direction: 1 | -1) => {
    const next = addDays(date, direction * step);
    setDate(
      next > today ? today : reachFrom && next < reachFrom ? reachFrom : next,
    );
  };

  const periodText =
    mode === 'day'
      ? date === today
        ? t('translations:earnings_today', { day: dayLabel(date) })
        : dayLabel(date)
      : t('translations:earnings_week_label', {
          from: moment(first, 'YYYY-MM-DD').format('D MMM'),
          to: moment(last, 'YYYY-MM-DD').format('D MMM'),
        });

  const openJob = (job: EarningsJob) =>
    navigation.navigate(MainScreens.EarningsDelivery, {
      deliveryId: job.deliveryId,
    });

  const onRefresh = () => {
    setPulling(true);
    Promise.allSettled([
      ...queries.map(query => query.refetch()),
      coop.refetch(),
    ]).finally(() => setPulling(false));
  };

  const recordedFromDay = merged.recordedFrom
    ? coopDate(Date.parse(merged.recordedFrom))
    : null;

  const body = () => {
    if (isLoading && loaded.length === 0) {
      return <ActivityIndicator />;
    }
    if (loaded.length === 0) {
      // Never opened on this phone: no signal now (AC-13), or the server answered with an error.
      const answered =
        failedEmpty && detailFailureOf(failedEmpty.error) !== 'noConnection';
      return answered ? (
        <Text style={styles.notice} testID="earnings-could-not-load">
          {t('translations:earnings_could_not_load_days')}
        </Text>
      ) : (
        <Text style={styles.notice} testID="earnings-needs-connection">
          {t('translations:earnings_needs_connection')}
        </Text>
      );
    }
    const shownDays =
      mode === 'day'
        ? [date]
        : dates
            .filter(
              day =>
                day <= today &&
                (!reachFrom || day >= reachFrom) &&
                (merged.days.some(
                  d =>
                    d.date === day && (d.workSeconds > 0 || d.moneyCents > 0),
                ) ||
                  shiftsOnDay(merged.shifts, day, Date.now()).length > 0 ||
                  noShiftJobOn(merged.jobsInNoShift, day)),
            )
            .reverse();
    return (
      <>
        {refreshFailed && (
          <Text style={styles.notice} testID="earnings-as-of">
            {t(
              offline
                ? 'translations:earnings_as_of'
                : 'translations:earnings_refresh_failed_as_of',
              { time: asOfLabel(asOf) },
            )}
          </Text>
        )}
        {figures && (
          <FiguresCard
            figures={figures}
            currencyCode={merged.currencyCode}
            soFar={soFar}
            cutFrom={cutFrom}
          />
        )}
        {coop.data && (
          <CoopWeekCard totals={coop.data} currencyCode={merged.currencyCode} />
        )}
        {mode === 'week' && shownDays.length === 0 && (
          <Text style={styles.notice} testID="earnings-no-work">
            {t('translations:earnings_no_work_week')}
          </Text>
        )}
        {shownDays.map(day => (
          <View key={day}>
            {mode === 'week' && (
              <Text style={styles.dayTitle}>{dayLabel(day)}</Text>
            )}
            <DayJobs date={day} merged={merged} onOpenJob={openJob} />
          </View>
        ))}
        {recordedFromDay && first < recordedFromDay && (
          <Text style={styles.notice}>
            {t('translations:time_worked_recorded_from', {
              date: moment(recordedFromDay, 'YYYY-MM-DD').format('D MMM YYYY'),
            })}
          </Text>
        )}
        {reachFrom && first <= reachFrom && (
          <Text style={styles.notice} testID="earnings-ask-coop">
            {t('translations:earnings_older_ask_coop')}
          </Text>
        )}
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
          <BackNavButton onPress={() => navigation.toggleDrawer()} />
          <Text style={styles.title}>{t('translations:earnings')}</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={pulling} onRefresh={onRefresh} />
          }>
          {/* Spec 0038 (AC-11): how offers and pay work. The mark says an answer to a review request
              has not been opened yet (kept on this phone only). */}
          <TouchableOpacity
            style={styles.howLink}
            onPress={() => navigation.navigate(MainScreens.HowItWorks)}
            accessibilityRole="link"
            testID="how-it-works-link">
            <Text style={styles.howLinkText}>
              {t('translations:how_title')}
            </Text>
            {hasNewAnswer ? (
              <Text style={styles.howLinkNew}>
                {t('translations:review_new_answer')}
              </Text>
            ) : null}
          </TouchableOpacity>

          <View style={styles.modeSwitch} accessibilityRole="tablist">
            {(['day', 'week'] as EarningsMode[]).map(item => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.modeButton,
                  mode === item && styles.modeButtonActive,
                ]}
                onPress={() => setMode(item)}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === item }}
                testID={`earnings-mode-${item}`}>
                <Text
                  style={[
                    styles.modeText,
                    mode === item && styles.modeTextActive,
                  ]}>
                  {t(`translations:earnings_mode_${item}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.periodRow}>
            <TouchableOpacity
              style={styles.periodArrow}
              disabled={!canGoBack}
              onPress={() => move(-1)}
              accessibilityRole="button"
              accessibilityLabel={t('translations:earnings_previous_period')}
              accessibilityState={{ disabled: !canGoBack }}
              testID="earnings-previous">
              <Icon
                icon={CaretLeftIcon}
                size={22}
                tone={canGoBack ? 'foreground' : 'input'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.periodLabel}
              onPress={() => {
                setCalendarMonth(monthOf(date));
                setCalendarOpen(open => !open);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: calendarOpen }}
              accessibilityHint={t('translations:earnings_open_calendar')}
              testID="earnings-period">
              <Icon icon={CalendarBlankIcon} size={20} />
              <Text style={styles.periodText}>{periodText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.periodArrow}
              disabled={!canGoForward}
              onPress={() => move(1)}
              accessibilityRole="button"
              accessibilityLabel={t('translations:earnings_next_period')}
              accessibilityState={{ disabled: !canGoForward }}
              testID="earnings-next">
              <Icon
                icon={CaretRightIcon}
                size={22}
                tone={canGoForward ? 'foreground' : 'input'}
              />
            </TouchableOpacity>
          </View>

          {calendarOpen && (
            <View style={styles.calendar}>
              <MonthCalendar
                month={calendarMonth}
                selected={dates}
                marked={marked}
                minDate={reachFrom}
                maxDate={today}
                onPick={picked => {
                  setDate(picked);
                  setCalendarOpen(false);
                }}
                onMonthChange={setCalendarMonth}
              />
            </View>
          )}

          {body()}

          {/* Spec 0050 (AC-8): monthly statements as PDF and CSV. */}
          <StatementsSection />
        </ScrollView>
      </ScreenSafeArea>
    </View>
  );
};
