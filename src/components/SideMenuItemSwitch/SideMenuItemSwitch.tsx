import React, { useMemo } from 'react';
import { StyleProp, ViewStyle, View, Text, Switch } from 'react-native';
import { styles } from './SideMenuItemSwitch.styles';
import { SideMenuItem } from '@app/types/types';
import { useTranslation } from 'react-i18next';
import { Icon } from '@app/components/Icon/Icon';
import { ArrowsClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';

type Props = {
  style?: StyleProp<ViewStyle>;
  isOn: boolean;
  onValueChange: (isOn: boolean) => void;
  item: SideMenuItem;
};

export const SideMenuItemSwitch = ({
  style,
  isOn,
  onValueChange,
  item,
}: Props) => {
  const { t } = useTranslation();
  const icon = useMemo(() => {
    switch (item) {
      case SideMenuItem.Location:
        return { glyph: MapPinIcon, weight: 'fill' as const };
      case SideMenuItem.AutoOrders:
        return { glyph: ArrowsClockwiseIcon, weight: 'regular' as const };
    }
  }, [item]);

  return (
    <View style={[styles.container, style]}>
      {icon && <Icon icon={icon.glyph} weight={icon.weight} size={32} />}
      <Text style={styles.text}>{t(`translations:${item}`)}</Text>
      <Switch value={isOn} onValueChange={onValueChange} />
    </View>
  );
};
