import React, { useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { styles } from './DefaultSound.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useTranslation } from 'react-i18next';
import {
  SettingsCell,
  SettingsCellType,
} from '@app/components/SettingsCell/SettingsCell';
import { Ringtone } from '@app/types/types';
import { SUPPORTED_RINGTONES } from '@app/utilities/constants';

type Props = MainScreenProp<MainScreens.DefaultSound>;

export const DefaultSound = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [selectedRingtone, setSelectedRingtone] = useState<string>(
    SUPPORTED_RINGTONES[1].name,
  );
  const ringtones = SUPPORTED_RINGTONES;

  const onSelect = (item: string) => {
    setSelectedRingtone(item);
  };

  const renderItem = ({ item, index }: { item: Ringtone; index: number }) => {
    return (
      <SettingsCell
        style={{ marginBottom: 16 }}
        title={item.name}
        cellType={SettingsCellType.radioButton}
        onSelect={onSelect}
        isSelected={selectedRingtone === item.name}
      />
    );
  };

  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('translations:default_sound')}</Text>
        </View>
        <FlatList
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyExtractor={(item, index) => index.toString()}
          data={ringtones}
          renderItem={renderItem}
        />
      </ScreenSafeArea>
    </View>
  );
};
