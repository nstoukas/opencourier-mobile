import React from 'react';
import { StyleProp, ViewStyle, View, Text } from 'react-native';
import { styles } from './InstanceHeader.styles';
import { Instance } from '@app/types/types';
import { useTranslation } from 'react-i18next';
import { BackNavButton } from '../BackNavButton/BackNavButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RemoteImage } from '@app/components/RemoteImage/RemoteImage';

type Props = {
  style?: StyleProp<ViewStyle>;
  instance: Instance;
  // Only the login screen uses this header now: there is no sign up (spec 0013).
  headerPurpose: 'login_to';
  onBack: () => void;
};

export const InstanceHeader = ({
  style,
  instance,
  onBack,
  headerPurpose,
}: Props) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();

  return (
    <View style={[styles.containerHeader, style]}>
      <View style={[styles.header, { paddingTop: top }]}>
        <BackNavButton onPress={onBack} />
        <View style={styles.headerContent}>
          <Text style={styles.textJoin}>
            {t(`translations:${headerPurpose}`) + ':'}
          </Text>
          <View style={styles.contentHeader}>
            <RemoteImage uri={instance.details.imageUrl} style={styles.image} />
            <View style={styles.containerHeaderText}>
              <Text style={styles.textName}>{instance.details.name}</Text>
              <Text style={styles.textCount}>{`${t(
                'translations:user_count',
              )}: ${instance.details.userCount}`}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.blueSeparator} />
    </View>
  );
};
