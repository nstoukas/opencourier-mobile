import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { styles } from './NoteCell.styles';
import { Icon } from '@app/components/Icon/Icon';
import { ChatsIcon } from 'phosphor-react-native/src/icons/Chats';

type Props = {
  style?: StyleProp<ViewStyle>;
  text: string;
};

export const NoteCell = ({ style, text }: Props) => {
  return (
    <View style={[styles.container, style]}>
      <Icon icon={ChatsIcon} size={26} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};
