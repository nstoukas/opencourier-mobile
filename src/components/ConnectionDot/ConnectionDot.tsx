import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@app/styles/colors';
import { ConnectionStatus } from '@app/services/liveConnection';
import { styles } from './ConnectionDot.styles';

// Colour and words for each connection status. The words are read out by a
// screen reader; on screen, a live connection is a filled dot and every other
// status a hollow ring, so a rider who cannot tell red from green still sees it.
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
    case 'refused':
      return {
        color: Colors.red1,
        labelKey: 'translations:connection_refused',
      };
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
// Just the dot, no words beside it (operator, 23 Nov: the header was too wordy).
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
        style={[
          styles.dot,
          status === 'connected'
            ? { backgroundColor: color }
            : [styles.ring, { borderColor: color }],
        ]}
        testID={`connection-dot-${status}`}
      />
    </View>
  );
};
