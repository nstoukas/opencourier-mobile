import React, { useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { styles } from './Language.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@app/utilities/constants';
import { Language } from '@app/types/types';
import {
  SettingsCell,
  SettingsCellType,
} from '@app/components/SettingsCell/SettingsCell';

type Props = MainScreenProp<MainScreens.LanguageScreen>;

export const LanguageScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(
    SUPPORTED_LANGUAGES[1],
  );
  const languages = SUPPORTED_LANGUAGES;

  const renderItem = ({ item, index }: { item: Language; index: number }) => {
    return (
      <SettingsCell
        style={{ marginBottom: 16 }}
        title={item.name}
        subtitle={`(${item.abreviation})`}
        cellType={SettingsCellType.radioButton}
        onSelect={lng => setSelectedLanguage(lng)}
        isSelected={selectedLanguage === item.name}
      />
    );
  };

  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('translations:language')}</Text>
        </View>
        <FlatList
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyExtractor={(item, index) => index.toString()}
          data={languages}
          renderItem={renderItem}
        />
      </ScreenSafeArea>
    </View>
  );
};
