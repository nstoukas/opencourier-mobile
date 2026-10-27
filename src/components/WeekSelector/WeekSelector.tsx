import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { styles } from './WeekSelector.styles';
import { EarningsTabItem } from '@app/types/types';
import moment, { Moment } from 'moment';
import { endOfWeek, formatEarnings, startOfWeek } from '@app/utilities/dates';
import { useTranslation } from 'react-i18next';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { CaretCircleLeftIcon } from 'phosphor-react-native/src/icons/CaretCircleLeft';
import { CaretCircleRightIcon } from 'phosphor-react-native/src/icons/CaretCircleRight';

type Props = {
  style?: StyleProp<ViewStyle>;
  type: EarningsTabItem;
  earned: number;
  /** ISO currency code from the API — the instance decides it, so never hard-code one. */
  currency?: string;
  onWeekRangeChange?: (start: Moment, end: Moment) => void;
};

export const WeekSelector = ({
  style,
  type,
  earned,
  currency,
  onWeekRangeChange,
}: Props) => {
  const { t } = useTranslation();
  const [substractor, setSubstractor] = useState<number>(0);

  useEffect(() => {
    setSubstractor(0);
  }, [type]);

  const date = useMemo(() => {
    switch (type) {
      case EarningsTabItem.Today:
        return `${t('translations:today')} ${moment().format(formatEarnings)}`;
      case EarningsTabItem.Weekly:
        return `${startOfWeek(substractor).format(
          formatEarnings,
        )} - ${endOfWeek(substractor).format(formatEarnings)}`;
      case EarningsTabItem.All:
        // Not literally all time: the API caps one request at 366 days, so say what the
        // number actually covers rather than implying a lifetime total.
        return t('translations:last_12_months');
    }
  }, [type, substractor]);

  useEffect(() => {
    onWeekRangeChange &&
      onWeekRangeChange(startOfWeek(substractor), endOfWeek(substractor));
  }, [substractor]);

  return (
    <View style={[styles.container, style]}>
      {type === EarningsTabItem.Weekly && (
        <TouchableOpacity
          hitSlop={hitSlopFor(32, 32, 8)}
          onPress={() => setSubstractor(substractor + 1)}>
          <Icon icon={CaretCircleLeftIcon} weight="fill" size={32} />
        </TouchableOpacity>
      )}
      <View style={styles.containerText}>
        <Text style={styles.textPrice}>
          {formatCurrencyFromCents(earned, currency)}
        </Text>
        <Text style={styles.textDate}>{date}</Text>
        <View style={styles.separator} />
      </View>
      {type === EarningsTabItem.Weekly && (
        <TouchableOpacity
          hitSlop={hitSlopFor(32, 32, 8)}
          onPress={() => setSubstractor(Math.max(0, substractor - 1))}>
          <Icon icon={CaretCircleRightIcon} weight="fill" size={32} />
        </TouchableOpacity>
      )}
    </View>
  );
};
