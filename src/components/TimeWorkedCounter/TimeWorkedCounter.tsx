import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TimerIcon } from 'phosphor-react-native/src/icons/Timer';
import { Icon } from '@app/components/Icon/Icon';
import { useCurrentTimeWorked } from '@app/hooks/useTimeWorked';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { formatWorkDuration } from '@app/utilities/timeWorked';
import { styles } from './TimeWorkedCounter.styles';

type Props = {
  // Whether Home is the screen in front (its useIsFocused).
  inFront?: boolean;
};

// Spec 0040 (AC-10): one small line on the home map while a shift is open, "3h12 · €38.50 ·
// €12.00/h", or "On break 12 min" while Offline with no job. It sits in Home's top row between the
// badge and SOS, so it never covers the offer or job card. It shows nothing when there is no open shift.
export const TimeWorkedCounter = ({ inFront = true }: Props) => {
  const { t } = useTranslation();
  const { view } = useCurrentTimeWorked(inFront);

  if (view.kind === 'none') {
    return null;
  }
  const text =
    view.kind === 'break'
      ? t('translations:time_worked_on_break', { minutes: view.breakMinutes })
      : [
          // Just the time: the timer icon says what it is (operator, 23 Nov).
          formatWorkDuration(view.workSeconds),
          formatCurrencyFromCents(view.moneyCents, view.currencyCode),
          view.centsPerHour === null
            ? '—'
            : t('translations:time_worked_per_hour', {
                amount: formatCurrencyFromCents(
                  view.centsPerHour,
                  view.currencyCode,
                ),
              }),
        ].join(' · ');

  return (
    <View style={styles.wrap} testID="time-worked-counter">
      <View style={styles.pill}>
        <Icon icon={TimerIcon} size={16} tone="muted-foreground" />
        {/* One line that shrinks its letters to fit a narrow phone, never cut off. */}
        <Text
          style={styles.text}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}>
          {text}
        </Text>
      </View>
    </View>
  );
};
