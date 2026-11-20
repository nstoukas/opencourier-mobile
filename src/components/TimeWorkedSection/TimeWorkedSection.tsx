import React, { useState } from 'react';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { Icon } from '@app/components/Icon/Icon';
import { CoopTotals, CoopWeek, WorkedShift } from '@app/types/timeWorked';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import {
  coopClock,
  formatShare,
  formatWorkDuration,
} from '@app/utilities/timeWorked';
import { styles } from './TimeWorkedSection.styles';

// Spec 0040's shift row and co-op card, reused by the Earnings screen (spec 0042, AC-6). The day list
// and its "Earlier" paging that lived here went with row 75: the Earnings screen lists days itself.

// The words for each kind of extra pay, shared with the delivery's pay breakdown.
export const REASON_KEYS: Record<string, string> = {
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

// Spec 0040, AC-12: the co-op's week. A small week shows only the sentence, never a figure.
export const CoopWeekLine = ({
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

// What changed the rider's status during the shift. Its jobs are listed under the shift on the
// Earnings screen itself (spec 0042), so they are not repeated here.
export const ShiftDetails = ({ shift }: { shift: WorkedShift }) => {
  const { t } = useTranslation();
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
    </View>
  );
};

// `continuesFrom` (a YYYY-MM-DD day) marks a shift that began the day before the one shown (AC-6).
export const ShiftRow = ({
  shift,
  continuesFrom,
  style,
}: {
  shift: WorkedShift;
  continuesFrom?: string;
  // The Earnings screen sets the row flush at the top of its card.
  style?: StyleProp<ViewStyle>;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const money = (cents: number) =>
    formatCurrencyFromCents(cents, shift.currencyCode);
  return (
    <View style={[styles.shift, style]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(value => !value)}
        style={styles.shiftHead}
        testID="time-worked-shift">
        <View style={styles.shiftText}>
          {continuesFrom ? (
            <Text style={styles.muted}>
              {t('translations:earnings_continues_from', {
                day: moment(continuesFrom, 'YYYY-MM-DD').format('ddd D MMM'),
              })}
            </Text>
          ) : null}
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

// Spec 0040, AC-12: the Co-op this week card, unchanged by spec 0042. A small week shows only the
// sentence, never a figure.
export const CoopWeekCard = ({
  totals,
  currencyCode,
}: {
  totals: CoopTotals;
  currencyCode: string;
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.card} testID="coop-week-card">
      <Text style={styles.cardTitle}>
        {t('translations:time_worked_coop_title')}
      </Text>
      <CoopWeekLine
        label={t('translations:time_worked_this_week')}
        week={totals.thisWeek}
        currencyCode={currencyCode}
      />
      <CoopWeekLine
        label={t('translations:time_worked_last_week')}
        week={totals.lastWeek}
        currencyCode={currencyCode}
      />
    </View>
  );
};
