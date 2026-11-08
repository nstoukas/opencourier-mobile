import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { Icon } from '@app/components/Icon/Icon';
import { useShifts } from '@app/hooks/useShifts';
import {
  bookingInProgress,
  nextBannerChange,
} from '@app/utilities/shiftBanner';
import { styles } from './ShiftBanner.styles';

type Props = {
  // Whether Home is the screen in front (its useIsFocused).
  inFront?: boolean;
};

// Spec 0027 (AC-8): with Shifts on, always says "ON SHIFT until 23:00" or "FREE (no shift)". It redraws
// at the next shift start or end on its own (a timer to that moment, on the server's clock), not by
// polling. The time is the server's text, never the phone's own formatting.
export const ShiftBanner = ({ inFront = true }: Props) => {
  const { t } = useTranslation();
  const { data, shiftsOn } = useShifts(inFront);
  const [, setTick] = useState(0);
  const bookings = data?.myBookings ?? [];
  const offset = data?.clockOffsetMs ?? 0;
  const serverNow = Date.now() + offset;
  const current = bookingInProgress(bookings, serverNow);
  const nextChange = nextBannerChange(bookings, serverNow);

  useEffect(() => {
    if (nextChange === null) {
      return;
    }
    // setTimeout takes at most about 24.8 days; a shift is never further than 14 days ahead.
    const timer = setTimeout(
      () => setTick(tick => tick + 1),
      nextChange - serverNow + 50,
    );
    return () => clearTimeout(timer);
  }, [nextChange, serverNow]);

  // Off, or not read yet: say nothing rather than a FREE that may be wrong (row 78 review).
  if (!shiftsOn || !data) {
    return null;
  }
  return (
    <View style={styles.wrap} testID="shift-banner">
      <View style={[styles.card, current ? styles.onShift : styles.free]}>
        <Icon
          icon={CalendarBlankIcon}
          size={20}
          tone={current ? 'primary-foreground' : 'muted-foreground'}
        />
        <Text style={[styles.text, current ? styles.onShiftText : null]}>
          {current
            ? t('translations:shift_banner_on', { time: current.endTime })
            : t('translations:shift_banner_free')}
        </Text>
      </View>
    </View>
  );
};
