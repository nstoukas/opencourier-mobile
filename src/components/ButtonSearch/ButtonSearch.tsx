import React from 'react';
import { StyleProp, ViewStyle, TouchableOpacity, View } from 'react-native';
import { styles } from './ButtonSearch.styles';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';

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
        <Icon icon={MagnifyingGlassIcon} weight="bold" size={20} />
      </View>
    </TouchableOpacity>
  );
};
