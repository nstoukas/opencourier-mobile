import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { Icon } from '@app/components/Icon/Icon';
import { useCoopTotals, useTimeWorkedPages } from '@app/hooks/useTimeWorked';
import { CoopWeek, WorkedDay, WorkedShift } from '@app/types/timeWorked';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import {
  coopClock,
  coopDate,
  formatShare,
  formatWorkDuration,
} from '@app/utilities/timeWorked';
import { styles } from './TimeWorkedSection.styles';

// The words for each kind of extra pay, the same the Earnings day screen uses.
const REASON_KEYS: Record<string, string> = {
  CANCELLATION: 'earnings_cancelled_job',
  REASSIGNMENT: 'earnings_reassigned_job',
  WAITING: 'earnings_waiting',
  REMOVAL: 'earnings_removal',
  RETURN_TRIP: 'earnings_return_trip',
  REVIEW: 'earnings_review_correction',
};

// Clock times and days are the co-op's (Europe/Athens), like the server's day rows and the admin's
// screens, whatever zone the phone is set to (review 2026-11-20, decision 36.48).
const clock = (iso: string) => coopClock(Date.parse(iso));

// A shift belongs under the co-op day it started on.
const dayOfShift = (shift: WorkedShift) =>
  coopDate(Date.parse(shift.startedAt));

// Spec 0040, AC-12: the co-op's week. A small week shows only the sentence, never a figure.
const CoopWeekLine = ({
  label,
  week,
  currencyCode,
}: {
  label: string;
  week: CoopWeek;
  currencyCode: string;
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.coopRow}>
      <Text style={styles.coopLabel}>{label}</Text>
      <Text style={styles.line}>
        {week.tooFewRiders
          ? t('translations:time_worked_too_few')
          : t('translations:time_worked_coop_line', {
              hours: formatWorkDuration(week.workSeconds),
              share: formatShare(week.unpaidShare),
              rate:
                week.centsPerHour === null
                  ? '—'
                  : t('translations:time_worked_per_hour', {
                      amount: formatCurrencyFromCents(
                        week.centsPerHour,
                        currencyCode,
                      ),
                    }),
            })}
      </Text>
    </View>
  );
};

const ShiftDetails = ({ shift }: { shift: WorkedShift }) => {
  const { t } = useTranslation();
  const money = (cents: number) =>
    formatCurrencyFromCents(cents, shift.currencyCode);
  return (
    <View style={styles.details} testID="time-worked-shift-details">
      <Text style={styles.detailsTitle}>
        {t('translations:time_worked_details_status')}
      </Text>
      {shift.statusChanges.map(change => (
        <Text key={`${change.at}-${change.toStatus}`} style={styles.muted}>
          {t('translations:time_worked_status_line', {
            time: clock(change.at),
            from: t(`translations:time_worked_status_${change.fromStatus}`),
            to: t(`translations:time_worked_status_${change.toStatus}`),
            cause: t(
              `translations:time_worked_cause_${change.cause}${
                change.cause === 'CUT_OFF' && change.byAdmin ? '_ADMIN' : ''
              }`,
            ),
          })}
        </Text>
      ))}
      {shift.jobs.length > 0 && (
        <Text style={styles.detailsTitle}>
          {t('translations:time_worked_details_jobs')}
        </Text>
      )}
      {shift.jobs.map(job => (
        <View key={`${job.deliveryId}-${job.acceptedAt}`} style={styles.job}>
          <Text style={styles.line}>
            {job.endedAt
              ? t('translations:time_worked_job_line', {
                  start: clock(job.acceptedAt),
                  end: clock(job.endedAt),
                  place: job.pickupName,
                })
              : t('translations:time_worked_job_open', {
                  start: clock(job.acceptedAt),
                  place: job.pickupName,
                })}
          </Text>
          <Text style={styles.muted}>
            {job.droppedOff
              ? t('translations:time_worked_job_pay', {
                  amount: money(job.deliveryMoneyCents),
                })
              : t('translations:time_worked_job_not_delivered')}
          </Text>
          {job.compensations.map(c => (
            <Text key={c.id} style={styles.muted}>
              {t(
                c.addedLater
                  ? 'translations:time_worked_compensation_later'
                  : 'translations:time_worked_compensation',
                {
                  reason: REASON_KEYS[c.reason]
                    ? t(`translations:${REASON_KEYS[c.reason]}`)
                    : c.reason,
                  amount: money(c.amountCents),
                  date: moment(
                    coopDate(Date.parse(c.createdAt)),
                    'YYYY-MM-DD',
                  ).format('D MMM'),
                },
              )}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
};

const ShiftRow = ({ shift }: { shift: WorkedShift }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const money = (cents: number) =>
    formatCurrencyFromCents(cents, shift.currencyCode);
  return (
    <View style={styles.shift}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(value => !value)}
        style={styles.shiftHead}
        testID="time-worked-shift">
        <View style={styles.shiftText}>
          {shift.startedBeforeRange && (
            <Text style={styles.muted}>
              {t('translations:time_worked_started_before')}
            </Text>
          )}
          <Text style={styles.line}>
            {shift.endedAt
              ? t('translations:time_worked_shift', {
                  start: clock(shift.startedAt),
                  end: clock(shift.endedAt),
                })
              : t('translations:time_worked_shift_open', {
                  start: clock(shift.startedAt),
                })}
            {' · '}
            {formatWorkDuration(shift.workSeconds)}
            {' · '}
            {money(shift.moneyCents)}
            {shift.centsPerHour === null
              ? ''
              : ` · ${t('translations:time_worked_per_hour', {
                  amount: money(shift.centsPerHour),
                })}`}
          </Text>
          <Text style={styles.muted}>
            {t('translations:time_worked_split', {
              job: formatWorkDuration(shift.jobSeconds),
              wait: formatWorkDuration(shift.paidWaitSeconds),
              unpaid: formatWorkDuration(shift.unpaidSeconds),
            })}
          </Text>
          {shift.lateMoneyCents > 0 && (
            <Text style={styles.muted}>
              {t('translations:time_worked_added_later', {
                amount: money(shift.lateMoneyCents),
              })}
            </Text>
          )}
          {shift.breaks.map(b => (
            <Text key={b.startedAt} style={styles.breakLine}>
              {t('translations:time_worked_break', {
                start: clock(b.startedAt),
                end: clock(b.endedAt),
              })}
            </Text>
          ))}
        </View>
        <Icon
          icon={open ? CaretDownIcon : CaretRightIcon}
          size={18}
          tone="muted-foreground"
        />
      </TouchableOpacity>
      {open && <ShiftDetails shift={shift} />}
    </View>
  );
};

const DayBlock = ({
  day,
  shifts,
  currencyCode,
}: {
  day: WorkedDay;
  shifts: WorkedShift[];
  currencyCode: string;
}) => {
  const { t } = useTranslation();
  const money = (cents: number) => formatCurrencyFromCents(cents, currencyCode);
  return (
    <View style={styles.day} testID="time-worked-day">
      <Text style={styles.dayTitle}>
        {moment(day.date, 'YYYY-MM-DD').format('ddd D MMM')}
      </Text>
      <Text style={styles.line}>
        {t('translations:time_worked_day_total', {
          time: formatWorkDuration(day.workSeconds),
          amount: money(day.moneyCents - day.unlinkedMoneyCents),
        })}
        {day.centsPerHour === null
          ? ''
          : ` · ${t('translations:time_worked_per_hour', {
              amount: money(day.centsPerHour),
            })}`}
      </Text>
      <Text style={styles.muted}>
        {t('translations:time_worked_split', {
          job: formatWorkDuration(day.jobSeconds),
          wait: formatWorkDuration(day.paidWaitSeconds),
          unpaid: formatWorkDuration(day.unpaidSeconds),
        })}
      </Text>
      {day.unlinkedMoneyCents > 0 && (
        <Text style={styles.muted}>
          {t('translations:time_worked_not_in_shift', {
            amount: money(day.unlinkedMoneyCents),
          })}
        </Text>
      )}
      {shifts.map(shift => (
        <ShiftRow key={shift.startedAt} shift={shift} />
      ))}
    </View>
  );
};

// Spec 0040, AC-11 and AC-12: the Time worked section of Earnings. The Co-op this week card first, then
// the rider's own days, newest first, each with its shifts. "Earlier" loads the 7 days before.
export const TimeWorkedSection = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const pages = useTimeWorkedPages();
  const coop = useCoopTotals();
  const { refetch: refetchPages } = pages;
  const { refetch: refetchCoop } = coop;

  // Drawer screens stay mounted, so the section reads again each time Earnings is shown.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refetchPages();
      refetchCoop();
    });
    return unsubscribe;
  }, [navigation, refetchPages, refetchCoop]);

  const loaded = pages.data?.pages ?? [];
  const first = loaded[0];
  const currencyCode = first?.currencyCode ?? 'EUR';
  // A shift that crosses into the next page is listed on both; keep it once. A shift longer than a day
  // is cut at the 24 hour look back with a different start, so it can still show twice: accepted, as
  // it needs a shift over a day long (review 2026-11-20).
  const seen = new Set<string>();
  const shifts: WorkedShift[] = [];
  for (const page of loaded) {
    for (const shift of page.shifts) {
      if (!seen.has(shift.startedAt)) {
        seen.add(shift.startedAt);
        shifts.push(shift);
      }
    }
  }
  const days = loaded
    .flatMap(page => page.days)
    .filter(day => day.workSeconds > 0 || day.moneyCents > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const shiftsOn = (date: string) =>
    shifts
      .filter(shift => dayOfShift(shift) === date)
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  // A shift that began on a day with no work counted in range (before the first day) still shows.
  const shownDays = new Set(days.map(day => day.date));
  const orphans = shifts.filter(shift => !shownDays.has(dayOfShift(shift)));

  return (
    <View style={styles.section} testID="time-worked-section">
      <Text style={styles.title}>{t('translations:time_worked_title')}</Text>

      {coop.data && (
        <View style={styles.card} testID="coop-week-card">
          <Text style={styles.cardTitle}>
            {t('translations:time_worked_coop_title')}
          </Text>
          <CoopWeekLine
            label={t('translations:time_worked_this_week')}
            week={coop.data.thisWeek}
            currencyCode={currencyCode}
          />
          <CoopWeekLine
            label={t('translations:time_worked_last_week')}
            week={coop.data.lastWeek}
            currencyCode={currencyCode}
          />
        </View>
      )}

      {pages.isLoading && <ActivityIndicator />}
      {pages.isError && !first && (
        <Text style={styles.muted}>{t('translations:time_worked_failed')}</Text>
      )}
      {first && (
        <Text style={styles.muted}>
          {first.recordedFrom
            ? t('translations:time_worked_recorded_from', {
                date: moment(
                  coopDate(Date.parse(first.recordedFrom)),
                  'YYYY-MM-DD',
                ).format('D MMM YYYY'),
              })
            : t('translations:time_worked_recorded_from_today')}
        </Text>
      )}
      {first && days.length === 0 && orphans.length === 0 && (
        <Text style={styles.muted}>{t('translations:time_worked_none')}</Text>
      )}
      {days.map(day => (
        <DayBlock
          key={day.date}
          day={day}
          shifts={shiftsOn(day.date)}
          currencyCode={currencyCode}
        />
      ))}
      {/* Shifts that began before the first day shown are the oldest, so they go last, newest first. */}
      {[...orphans]
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
        .map(shift => (
          <ShiftRow key={shift.startedAt} shift={shift} />
        ))}
      {pages.hasNextPage && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            pages.fetchNextPage();
          }}
          disabled={pages.isFetchingNextPage}
          style={styles.earlier}
          testID="time-worked-earlier">
          <Text style={styles.earlierText}>
            {t('translations:time_worked_earlier')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
