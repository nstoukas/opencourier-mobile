import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrivalStage } from '@app/utilities/arrival';
import { LegFigures } from '@app/utilities/routeLegs';
import { color, radius, space, typeScale } from '@app/styles/theme';

type Props = {
  stage: ArrivalStage;
  toRestaurant?: LegFigures;
  toCustomer?: LegFigures;
};

// Spec 0021 (AC-6): "● Restaurant ─ ○ Customer" at the top of the job card,
// the current stop filled, a done one ticked, each with its km from the
// co-op's route when known (row 69).
export const StageStrip = ({ stage, toRestaurant, toCustomer }: Props) => {
  const { t } = useTranslation();
  const atPickup = stage === 'pickup';
  const stop = (
    label: string,
    state: 'current' | 'done' | 'next',
    km?: string,
  ) => (
    <View style={styles.stop}>
      <View
        style={[
          styles.dot,
          state === 'current' && styles.dotCurrent,
          state === 'done' && styles.dotDone,
        ]}
      />
      <Text
        style={[styles.label, state === 'current' && styles.labelCurrent]}
        accessibilityState={{ selected: state === 'current' }}>
        {label}
        {km ? ` · ${km} km` : ''}
      </Text>
    </View>
  );
  return (
    <View style={styles.strip} testID="job-stage-strip">
      {stop(
        t('translations:stage_restaurant'),
        atPickup ? 'current' : 'done',
        atPickup ? toRestaurant?.km : undefined,
      )}
      <View style={styles.rule} />
      {stop(
        t('translations:stage_customer'),
        atPickup ? 'next' : 'current',
        toCustomer?.km,
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1.5'],
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: color['muted-foreground'],
  },
  dotCurrent: {
    backgroundColor: color.foreground,
    borderColor: color.foreground,
  },
  dotDone: {
    backgroundColor: color.success,
    borderColor: color.success,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: color.border,
  },
  label: {
    ...typeScale.caption,
    color: color['muted-foreground'],
  },
  labelCurrent: {
    color: color.foreground,
  },
});
