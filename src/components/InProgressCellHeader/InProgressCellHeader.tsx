import React from 'react';
import {
  StyleProp,
  ViewStyle,
  View,
  Image,
  Text,
  TouchableOpacity,
  ImageSourcePropType,
} from 'react-native';
import { styles } from './InProgressCellHeader.styles';
import { Images } from '@app/utilities/images';
import { Colors } from '@app/styles/colors';
import { hitSlopFor } from '@app/utilities/touch';

type Props = {
  style?: StyleProp<ViewStyle>;
  expanded: boolean;
  onExpandedPress: () => void;
  icon: ImageSourcePropType;
  title: string;
  finished: boolean;
};

export const InProgressCellHeader = ({
  style,
  expanded,
  onExpandedPress,
  icon,
  title,
  finished = false,
}: Props) => {
  return (
    <View style={[styles.containerHeader, style]}>
      <Image
        source={icon}
        style={[
          styles.iconGrayRestaurant,
          finished && { tintColor: Colors.green1 },
        ]}
      />
      <Text style={[styles.textName, finished && { color: Colors.green1 }]}>
        {title}
      </Text>
      <TouchableOpacity
        hitSlop={hitSlopFor(24)}
        disabled={finished}
        style={styles.buttonCarret}
        onPress={() => !finished && onExpandedPress()}>
        {finished && <Image source={Images.CheckmarkHollow} />}
        {!finished && (
          <Image
            source={Images.CaretDown}
            style={[
              styles.iconCaret,
              expanded && { transform: [{ rotate: '180deg' }] },
            ]}
          />
        )}
      </TouchableOpacity>
    </View>
  );
};
