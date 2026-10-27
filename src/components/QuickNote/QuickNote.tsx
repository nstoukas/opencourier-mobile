import React, { useMemo } from 'react';
import { StyleProp, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { styles } from './QuickNote.styles';
import { Colors } from '@app/styles/colors';
import { CustomerNotes } from '@app/types/types';
import { useTranslation } from 'react-i18next';
import { touchRow } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { BellSlashIcon } from 'phosphor-react-native/src/icons/BellSlash';
import { DoorOpenIcon } from 'phosphor-react-native/src/icons/DoorOpen';
import { DropIcon } from 'phosphor-react-native/src/icons/Drop';
import { FireIcon } from 'phosphor-react-native/src/icons/Fire';

type Props = {
  style?: StyleProp<ViewStyle>;
  text: string;
  selected: boolean;
  createdByUser: boolean;
  onPress: (note: string) => void;
};

export const QuickNote = ({
  style,
  text,
  selected,
  onPress,
  createdByUser = false,
}: Props) => {
  const { t } = useTranslation();
  const icon = useMemo(() => {
    switch (text) {
      case CustomerNotes.BellnotRung:
        return { glyph: BellSlashIcon, weight: 'fill' as const };
      case CustomerNotes.DontBlockDoor:
        return { glyph: DoorOpenIcon, weight: 'regular' as const };
      case CustomerNotes.HandleWithCare:
        return { glyph: FireIcon, weight: 'fill' as const };
      case CustomerNotes.PreventLeaks:
        return { glyph: DropIcon, weight: 'fill' as const };
      default:
        return null;
    }
  }, [text]);

  const customerNotes = Object.values(CustomerNotes);

  return (
    <TouchableOpacity
      onPress={() => onPress(text)}
      style={[
        touchRow,
        styles.container,
        style,
        createdByUser && { backgroundColor: Colors.white2, borderWidth: 0 },
        selected && {
          borderColor: Colors.green1,
          backgroundColor: Colors.green1,
        },
      ]}>
      {icon && (
        <Icon
          icon={icon.glyph}
          weight={icon.weight}
          size={16}
          tone={selected ? 'success-soft' : 'foreground'}
        />
      )}
      <Text
        style={[
          styles.text,
          selected && { color: Colors.white },
          icon && { marginLeft: 8 },
        ]}>
        {customerNotes.find(note => note == text)
          ? t(`translations:${text}`)
          : text}
      </Text>
    </TouchableOpacity>
  );
};
