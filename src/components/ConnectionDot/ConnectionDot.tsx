import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@app/styles/colors';
import { ConnectionStatus } from '@app/services/liveConnection';
import { styles } from './ConnectionDot.styles';

// Colour and words for each connection status. Words as well as colour, so
// the dot still reads for a rider who cannot tell red from green.
export const connectionDotLook = (
  status: ConnectionStatus,
): { color: string; labelKey: string } => {
  switch (status) {
    case 'connected':
      return { color: Colors.green8, labelKey: 'translations:connection_live' };
    case 'connecting':
      return {
        color: Colors.orange1,
        labelKey: 'translations:connection_connecting',
      };
    case 'disconnected':
      return { color: Colors.red1, labelKey: 'translations:connection_lost' };
    case 'off':
      return { color: Colors.gray5, labelKey: 'translations:connection_off' };
  }
};

type Props = {
  status: ConnectionStatus;
  style?: StyleProp<ViewStyle>;
};

// The dot on the home screen (row 57): is the live connection up right now?
// For the rider's own eyes only; nothing about it is stored or sent anywhere.
export const ConnectionDot = ({ status, style }: Props) => {
  const { t } = useTranslation();
  const { color, labelKey } = connectionDotLook(status);
  const label = t(labelKey);

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      testID="connection-dot">
      <View
        style={[styles.dot, { backgroundColor: color }]}
        testID={`connection-dot-${status}`}
      />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};
