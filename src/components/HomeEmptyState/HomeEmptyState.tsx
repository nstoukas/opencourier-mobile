import React, { useMemo } from 'react';
import { Image, StyleProp, ViewStyle, View, Text } from 'react-native';
import { Images } from '@app/utilities/images';
import { styles } from './HomeEmptyState.styles';
import { HomeEmptyState } from '@app/types/types';
import { useTranslation } from 'react-i18next';

type Props = {
  style?: StyleProp<ViewStyle>;
  state: HomeEmptyState;
};

export const HomeEmptyStateComponent = ({ style, state }: Props) => {
  const { t } = useTranslation();
  const imageSource = useMemo(() => {
    switch (state) {
      case HomeEmptyState.History:
        return Images.Car;
    }
  }, [state]);

  const title = useMemo(() => {
    switch (state) {
      case HomeEmptyState.History:
        return t('translations:no_previous_orders');
    }
  }, [state]);

  return (
    <View style={[styles.container, style]}>
      <Image source={imageSource} style={styles.imageSmall} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{t('translations:notify_when_order')}</Text>
    </View>
  );
};
