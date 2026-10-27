import React from 'react';
import {
  Image,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { styles } from './PhotoCell.styles';
import { Photo } from '@app/types/types';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { ArrowCounterClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowCounterClockwise';
import { XCircleIcon } from 'phosphor-react-native/src/icons/XCircle';

type Props = {
  style?: StyleProp<ViewStyle>;
  image: Photo;
  onDelete: () => void;
  onRetake: () => void;
};

export const PhotoCell = ({ style, image, onDelete, onRetake }: Props) => {
  return (
    <View style={[styles.container, style]}>
      <Image source={{ uri: image.uri }} style={styles.image} />
      <View style={styles.containerRight}>
        <TouchableOpacity
          hitSlop={hitSlopFor(35, 35, 4)}
          style={styles.containerHorizontal}
          onPress={onRetake}>
          <Icon icon={ArrowCounterClockwiseIcon} size={16} />
          <Text style={styles.text}>Retake photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={hitSlopFor(35, 35, 4)}
          style={styles.containerHorizontal}
          onPress={onDelete}>
          <Icon icon={XCircleIcon} size={16} />
          <Text style={styles.text}>Delete photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
