import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { Icon } from '@app/components/Icon/Icon';
import { addMonths, monthGrid } from '@app/utilities/earnings';
import { styles } from './MonthCalendar.styles';

// Spec 0042, AC-7: a month grid on the app's design system theme, Monday first, with no calendar
// library. A day with work or money carries a dot; days before the rider's reach and after today
// cannot be picked. Which day a pick shows (the day, or its week) is the screen's business.

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7].map(day =>
  moment().isoWeekday(day).format('dd'),
);

type Props = {
  // YYYY-MM, the month on show.
  month: string;
  // The days that are highlighted: the picked day, or every day of the picked week.
  selected: string[];
  // Days with work or money (YYYY-MM-DD).
  marked: ReadonlySet<string>;
  // The first and last day that can be picked; null while not known yet.
  minDate: string | null;
  maxDate: string;
  onPick: (date: string) => void;
  onMonthChange: (month: string) => void;
};

export const MonthCalendar = ({
  month,
  selected,
  marked,
  minDate,
  maxDate,
  onPick,
  onMonthChange,
}: Props) => {
  const { t } = useTranslation();
  const canGoBack = minDate === null || `${month}-01` > minDate;
  const canGoForward = addMonths(month, 1) <= maxDate.slice(0, 7);
  const pickable = (date: string) =>
    date <= maxDate && (minDate === null || date >= minDate);

  return (
    <View style={styles.container} testID="earnings-calendar">
      <View style={styles.head}>
        <TouchableOpacity
          style={styles.arrow}
          disabled={!canGoBack}
          onPress={() => onMonthChange(addMonths(month, -1))}
          accessibilityRole="button"
          accessibilityLabel={t('translations:earnings_previous_month')}
          accessibilityState={{ disabled: !canGoBack }}
          testID="calendar-previous">
          <Icon
            icon={CaretLeftIcon}
            size={20}
            tone={canGoBack ? 'foreground' : 'input'}
          />
        </TouchableOpacity>
        <Text style={styles.monthTitle} accessibilityRole="header">
          {moment(`${month}-01`, 'YYYY-MM-DD').format('MMMM YYYY')}
        </Text>
        <TouchableOpacity
          style={styles.arrow}
          disabled={!canGoForward}
          onPress={() => onMonthChange(addMonths(month, 1))}
          accessibilityRole="button"
          accessibilityLabel={t('translations:earnings_next_month')}
          accessibilityState={{ disabled: !canGoForward }}
          testID="calendar-next">
          <Icon
            icon={CaretRightIcon}
            size={20}
            tone={canGoForward ? 'foreground' : 'input'}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map(name => (
          <Text key={name} style={styles.weekday}>
            {name}
          </Text>
        ))}
      </View>
      {monthGrid(month).map(week => (
        <View key={week.find(Boolean) ?? 'empty'} style={styles.week}>
          {week.map((date, index) => {
            if (!date) {
              return <View key={`pad-${index}`} style={styles.cell} />;
            }
            const enabled = pickable(date);
            const isSelected = selected.includes(date);
            return (
              <TouchableOpacity
                key={date}
                style={[styles.cell, isSelected && styles.cellSelected]}
                disabled={!enabled}
                onPress={() => onPick(date)}
                accessibilityRole="button"
                accessibilityLabel={moment(date, 'YYYY-MM-DD').format(
                  'dddd D MMMM',
                )}
                accessibilityState={{
                  disabled: !enabled,
                  selected: isSelected,
                }}
                testID={`calendar-day-${date}`}>
                <Text
                  style={[
                    styles.cellText,
                    !enabled && styles.cellTextDisabled,
                    isSelected && styles.cellTextSelected,
                  ]}>
                  {Number(date.slice(8))}
                </Text>
                <View
                  style={[styles.dot, !marked.has(date) && styles.dotHidden]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};
