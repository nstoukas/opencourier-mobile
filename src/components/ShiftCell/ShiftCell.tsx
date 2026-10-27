import React from 'react';
import {
  Image,
  StyleProp,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { styles } from './ShiftCell.styles';
import { Images } from '@app/utilities/images';
import { useTranslation } from 'react-i18next';
import { Shift, ShiftRange } from '@app/types/types';
import { Colors } from '@app/styles/colors';
import moment from 'moment';
import { formatShift } from '@app/utilities/dates';
import { hitSlopFor } from '@app/utilities/touch';

type Props = {
  style?: StyleProp<ViewStyle>;
  item: Shift;
  isSelected: boolean;
  onAdd: (item: Shift) => void;
  onDelete: (item: Shift, range: ShiftRange) => void;
  onSelect: (item: Shift) => void;
};

export const ShiftCell = ({
  style,
  item,
  isSelected = false,
  onAdd,
  onDelete,
  onSelect,
}: Props) => {
  const { t } = useTranslation();

  return (
    <View style={[style]}>
      <TouchableOpacity
        style={styles.content}
        onPress={() => onSelect && onSelect(item)}>
        <Image
          source={isSelected ? Images.RadioSelected : Images.RadioUnselected}
          style={styles.imageRadioButton}
        />
        <Text style={styles.textTitle}>{t(`translations:${item.day}`)}</Text>
        <View style={{ flex: 1, height: 0 }} />
        {isSelected && (
          <TouchableOpacity
            hitSlop={hitSlopFor(30, 24)}
            style={styles.buttonDeleteAdd}
            onPress={() => onAdd(item)}>
            <Text>+</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      {isSelected && (
        <View style={styles.containerRanges}>
          {item.shiftRanges.map(obj => (
            <View style={styles.containerShift}>
              <Text style={styles.textTime}>
                {moment(obj.start).format(formatShift)}
              </Text>
              <Text> - </Text>
              <Text style={styles.textTime}>
                {moment(obj.end).format(formatShift)}
              </Text>
              <View style={{ height: 0, flex: 1 }} />
              <TouchableOpacity
                hitSlop={hitSlopFor(30, 24)}
                onPress={() => onDelete(item, obj)}
                style={styles.buttonDeleteAdd}>
                <Image source={Images.Trash} style={styles.iconTrash} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <View style={styles.separator} />
    </View>
  );
};
