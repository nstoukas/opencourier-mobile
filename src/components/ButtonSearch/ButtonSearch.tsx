import React from 'react';
import {
  Image,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import { Images } from '@app/utilities/images';
import { styles } from './ButtonSearch.styles';
import { hitSlopFor } from '@app/utilities/touch';

type Props = {
  style?: StyleProp<ViewStyle>;
  onPress: (toggled: boolean) => void;
  isSearching: boolean;
};

export const ButtonSearch = ({ style, onPress, isSearching }: Props) => {
  const onToggle = () => {
    onPress(!isSearching);
  };

  return (
    <TouchableOpacity
      hitSlop={hitSlopFor(40)}
      style={[styles.container, style]}
      onPress={onToggle}>
      <View style={styles.containerOutUntoggled}>
        <Image source={Images.Search} />
      </View>
    </TouchableOpacity>
  );
};
