import React from 'react';
import { StyleProp, ViewStyle, View, Text, FlatList } from 'react-native';
import { styles } from './PopularNearbyInstances.styles';
import { Instance } from '@app/types/types';
import { useTranslation } from 'react-i18next';
import { InstanceCell } from '../InstanceCell/InstanceCell';
import { Icon } from '@app/components/Icon/Icon';
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle';

type Props = {
  style?: StyleProp<ViewStyle>;
  instances: Instance[];
  onPress: (instance: Instance) => void;
};

export const PopularNearbyInstances = ({
  style,
  instances,
  onPress,
}: Props) => {
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <View style={[styles.containerHeader, style]}>
        <Icon icon={SparkleIcon} size={20} />
        <Text style={styles.textTitle}>{t('translations:popular_nearby')}</Text>
      </View>
      <FlatList
        data={instances.slice(0, 5)}
        renderItem={({ item }) => (
          <InstanceCell instance={item} onPress={onPress} />
        )}
        keyExtractor={item => item.details.link}
      />
    </View>
  );
};
