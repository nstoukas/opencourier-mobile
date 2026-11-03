import React, { useMemo } from 'react';
import { StyleProp, ViewStyle, Text, TouchableOpacity } from 'react-native';
import { styles } from './SideMenuItemPlain.styles';
import { SideMenuItem } from '@app/types/types';
import { useTranslation } from 'react-i18next';
import { Icon } from '@app/components/Icon/Icon';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CardholderIcon } from 'phosphor-react-native/src/icons/Cardholder';
import { ClockCounterClockwiseIcon } from 'phosphor-react-native/src/icons/ClockCounterClockwise';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { GearSixIcon } from 'phosphor-react-native/src/icons/GearSix';
import { NoteIcon } from 'phosphor-react-native/src/icons/Note';
import { PiggyBankIcon } from 'phosphor-react-native/src/icons/PiggyBank';
import { QuestionIcon } from 'phosphor-react-native/src/icons/Question';
import { SignOutIcon } from 'phosphor-react-native/src/icons/SignOut';

type Props = {
  style?: StyleProp<ViewStyle>;
  onPress: (item: SideMenuItem) => void;
  item: SideMenuItem;
  hideArrow?: boolean;
};

export const SideMenuItemPlain = ({
  style,
  onPress,
  item,
  hideArrow,
}: Props) => {
  const { t } = useTranslation();
  const icon = useMemo(() => {
    switch (item) {
      case SideMenuItem.Orders:
        return { glyph: NoteIcon, weight: 'fill' as const };
      case SideMenuItem.History:
        return { glyph: ClockCounterClockwiseIcon, weight: 'fill' as const };
      case SideMenuItem.Shifts:
        return { glyph: CalendarBlankIcon, weight: 'fill' as const };
      case SideMenuItem.Earnings:
        return { glyph: PiggyBankIcon, weight: 'fill' as const };
      case SideMenuItem.Payout:
        return { glyph: CardholderIcon, weight: 'fill' as const };
      case SideMenuItem.Support:
        return { glyph: QuestionIcon, weight: 'fill' as const };
      case SideMenuItem.Settings:
        return { glyph: GearSixIcon, weight: 'fill' as const };
      case SideMenuItem.Logout:
        return { glyph: SignOutIcon, weight: 'regular' as const };
    }
  }, [item]);

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={() => onPress(item)}>
      {icon && <Icon icon={icon.glyph} weight={icon.weight} size={32} />}
      <Text style={styles.text}>{t(`translations:${item}`)}</Text>
      {!hideArrow && <Icon icon={CaretRightIcon} />}
    </TouchableOpacity>
  );
};
