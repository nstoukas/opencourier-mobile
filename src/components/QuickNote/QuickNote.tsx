import React, { useMemo } from 'react';
import {
  Image,
  StyleProp,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { styles } from './QuickNote.styles';
import { Colors } from '@app/styles/colors';
import { CustomerNotes } from '@app/types/types';
import { Images } from '@app/utilities/images';
import { useTranslation } from 'react-i18next';
import { touchRow } from '@app/utilities/touch';

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
        return Images.BellSlash;
      case CustomerNotes.DontBlockDoor:
        return Images.DoorOpen;
      case CustomerNotes.HandleWithCare:
        return Images.Fire;
      case CustomerNotes.PreventLeaks:
        return Images.Drop;
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
        <Image
          source={icon}
          style={[
            styles.icon,
            { tintColor: selected ? Colors.green5 : Colors.black1 },
          ]}
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
