import React, { useMemo, useState } from 'react';
import { StyleProp, ViewStyle, View, TextInput } from 'react-native';
import { styles } from './SearchBar.styles';
import { Colors } from '@app/styles/colors';
import { Icon } from '@app/components/Icon/Icon';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';

type Props = {
  style?: StyleProp<ViewStyle>;
  onTextChange: (text: string) => void;
  text: string;
  placeholder?: string;
};

export const SearchBar = ({
  style,
  onTextChange,
  text,
  placeholder,
}: Props) => {
  const [isActive, setIsActive] = useState<boolean>(false);

  const borderColor = useMemo(() => {
    if (isActive) {
      return Colors.yellow5;
    } else {
      return Colors.gray21;
    }
  }, [isActive]);

  return (
    <View style={[styles.container, style, { borderColor: borderColor }]}>
      <View style={styles.content}>
        <Icon icon={MagnifyingGlassIcon} size={20} style={styles.search} />
        <TextInput
          placeholderTextColor={Colors.gray21}
          placeholder={placeholder ? placeholder : 'Search'}
          style={styles.textInput}
          value={text}
          onFocus={() => setIsActive(true)}
          onBlur={() => setIsActive(false)}
          onChangeText={onTextChange}
        />
      </View>
    </View>
  );
};
