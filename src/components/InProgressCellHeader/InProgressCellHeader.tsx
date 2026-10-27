import React from 'react';
import {
  StyleProp,
  ViewStyle,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { styles } from './InProgressCellHeader.styles';
import { Colors } from '@app/styles/colors';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
// `import type`: a TypeScript type only, removed when the app is built.
import type { Icon as PhosphorIcon } from 'phosphor-react-native';

type Props = {
  style?: StyleProp<ViewStyle>;
  expanded: boolean;
  onExpandedPress: () => void;
  // The place's Phosphor icon (a storefront for the pickup, a house for the drop off).
  icon: PhosphorIcon;
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
      <Icon
        icon={icon}
        size={32}
        tone={finished ? 'success' : 'muted-foreground'}
        style={styles.iconGrayRestaurant}
      />
      <Text style={[styles.textName, finished && { color: Colors.green1 }]}>
        {title}
      </Text>
      <TouchableOpacity
        hitSlop={hitSlopFor(24)}
        disabled={finished}
        style={styles.buttonCarret}
        onPress={() => !finished && onExpandedPress()}>
        {finished && <Icon icon={CheckCircleIcon} tone="success" />}
        {!finished && (
          <Icon
            icon={CaretDownIcon}
            weight="bold"
            size={32}
            style={expanded && { transform: [{ rotate: '180deg' }] }}
          />
        )}
      </TouchableOpacity>
    </View>
  );
};
