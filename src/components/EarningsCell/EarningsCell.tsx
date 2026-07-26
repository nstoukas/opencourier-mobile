import React, { useMemo } from 'react';
import {
  Image,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { styles } from './EarningsCell.styles';
import moment, { Moment } from 'moment';
import { nameOfDay, shortDate } from '@app/utilities/dates';
import { useTranslation } from 'react-i18next';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { Images } from '@app/utilities/images';

type Props = {
  style?: StyleProp<ViewStyle>;
  date: Moment;
  earned: number;
  /** ISO currency code from the API — the instance decides it, so never hard-code one. */
  currency?: string;
  /** Extra context under the heading, e.g. '3 deliveries'. */
  detail?: string;
  /** When given, the row becomes tappable and drills into the day. */
  onPress?: () => void;
};

export const EarningsCell = ({
  style,
  date,
  earned,
  currency,
  detail,
  onPress,
}: Props) => {
  const { t } = useTranslation();

  // 'Today' and 'Yesterday' are what a courier actually calls the two days they check
  // most; older rows fall back to the weekday name.
  const heading = useMemo(() => {
    const today = moment();
    if (date.isSame(today, 'day')) {
      return t('translations:today');
    }
    // clone() because moment objects are mutable — subtract() would move `today` itself.
    if (date.isSame(today.clone().subtract(1, 'day'), 'day')) {
      return t('translations:yesterday');
    }
    return t(`translations:${nameOfDay(date)}`);
  }, [date, t]);

  // The date is always shown, even when the heading already names the day — it is the
  // one label that stays unambiguous when scrolling back through past weeks.
  const subtitle = detail ? `${shortDate(date)} · ${detail}` : shortDate(date);

  const rowStyle = [styles.container, style];
  const content = (
    <>
      <View style={styles.containerText}>
        <Text style={styles.textDay}>{heading}</Text>
        <Text style={styles.textDetail}>{subtitle}</Text>
      </View>
      <Text style={styles.textEarned}>
        {formatCurrencyFromCents(earned, currency)}
      </Text>
      {onPress && (
        <Image source={Images.ArrowRightBlack} style={styles.iconArrow} />
      )}
    </>
  );

  // Touchable only when the row drills into a day, so a row that goes nowhere doesn't
  // give the press feedback of one that does.
  if (onPress) {
    return (
      <TouchableOpacity style={rowStyle} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={rowStyle}>{content}</View>;
};
