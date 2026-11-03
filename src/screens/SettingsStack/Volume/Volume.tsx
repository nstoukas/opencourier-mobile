import React, { useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { styles } from './Volume.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useTranslation } from 'react-i18next';
import {
  SettingsCell,
  SettingsCellType,
} from '@app/components/SettingsCell/SettingsCell';
import { SUPPORTED_VOLUMES } from '@app/utilities/constants';
import { Volume } from '@app/types/types';

type Props = MainScreenProp<MainScreens.VolumeScreen>;

export const VolumeScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [selectedVolume, setSelectedVolume] = useState<string>(
    SUPPORTED_VOLUMES[1].name,
  );
  const volumes = SUPPORTED_VOLUMES;

  const onSelect = (item: string) => {
    setSelectedVolume(item);
  };

  const renderItem = ({ item, index }: { item: Volume; index: number }) => {
    return (
      <SettingsCell
        style={{ marginBottom: 16 }}
        title={item.name}
        cellType={SettingsCellType.radioButton}
        onSelect={onSelect}
        isSelected={selectedVolume === item.name}
      />
    );
  };

  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('translations:volume')}</Text>
        </View>
        <FlatList
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyExtractor={(item, index) => index.toString()}
          data={volumes}
          renderItem={renderItem}
        />
      </ScreenSafeArea>
    </View>
  );
};
