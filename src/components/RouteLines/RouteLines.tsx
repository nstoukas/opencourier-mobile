import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@app/components/Icon/Icon';
import { PathIcon } from 'phosphor-react-native/src/icons/Path';
import { color, space, typeScale } from '@app/styles/theme';
import { LegFigures } from '@app/utilities/routeLegs';

type Props = {
  toRestaurant?: LegFigures;
  toCustomer?: LegFigures;
  // The route could not be had (OSRM down, no signal): the pins stay, and
  // this says so instead of the lines (spec 0018, AC-6).
  unavailable: boolean;
};

// Spec 0018 (AC-7): the distance lines on the offer and job cards, from the
// co-op's own route. A line whose leg is not there is left out.
export const RouteLines = ({
  toRestaurant,
  toCustomer,
  unavailable,
}: Props) => {
  const { t } = useTranslation();
  if (unavailable && !toRestaurant && !toCustomer) {
    return (
      <Text style={styles.line} testID="route-unavailable">
        {t('translations:route_not_available')}
      </Text>
    );
  }
  const lines = [
    toRestaurant && {
      key: 'restaurant',
      text: t('translations:route_to_restaurant', toRestaurant),
    },
    toCustomer && {
      key: 'customer',
      text: t('translations:route_to_customer', toCustomer),
    },
  ].filter((line): line is { key: string; text: string } => !!line);
  if (lines.length === 0) {
    return null;
  }
  return (
    <View style={styles.container}>
      {lines.map(line => (
        <View key={line.key} style={styles.row}>
          <Icon icon={PathIcon} size={20} tone="muted-foreground" />
          <Text style={styles.line} testID={`route-line-${line.key}`}>
            {line.text}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: space['1'],
    marginVertical: space['2'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  line: {
    ...typeScale['body-sm'],
    color: color['muted-foreground'],
  },
});
