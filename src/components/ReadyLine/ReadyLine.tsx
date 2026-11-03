import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { readyLine } from '@app/utilities/readySignals';
import { color, typeScale } from '@app/styles/theme';

// How often the minutes are worked out again (spec 0023, AC-7).
export const READY_LINE_TICK_MS = 30 * 1000;

type Props = {
  foodReadyAt?: string | null;
  readyAtOnPhone?: number | null;
};

// Spec 0023 (AC-7): "Preparing, ~8 min", "Preparing, due now" or "Ready" on the job card, before
// pickup. Its own component with its own tick, so the rest of the card does not redraw every 30 s.
export const ReadyLine = ({ foodReadyAt, readyAtOnPhone }: Props) => {
  const { t } = useTranslation();
  // A counter the timer bumps to redraw; the time itself is read on every draw, so a new ready time
  // (the refetch after a delay) or a return to the app never shows a minute up to 30 s old (row 21
  // review).
  const [, setTick] = useState(0);

  useEffect(() => {
    // Nothing to count down once the food is ready, or for an order with no ready time.
    if (
      foodReadyAt ||
      readyAtOnPhone === null ||
      readyAtOnPhone === undefined
    ) {
      return;
    }
    const timer = setInterval(
      () => setTick(tick => tick + 1),
      READY_LINE_TICK_MS,
    );
    return () => clearInterval(timer);
  }, [foodReadyAt, readyAtOnPhone]);

  const line = readyLine(
    { foodReadyAt, readyAtOnPhone },
    Date.now(),
    t as never,
  );
  if (line === '') {
    return null;
  }
  return (
    <Text
      style={[styles.line, foodReadyAt ? styles.ready : null]}
      testID="job-ready-line">
      {line}
    </Text>
  );
};

const styles = StyleSheet.create({
  line: {
    ...typeScale.body,
    fontWeight: '600',
    color: color.foreground,
  },
  ready: {
    color: color.success,
  },
});
