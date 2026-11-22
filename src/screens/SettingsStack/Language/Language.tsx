import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { styles } from './Language.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useTranslation } from 'react-i18next';
import {
  SettingsCell,
  SettingsCellType,
} from '@app/components/SettingsCell/SettingsCell';
import {
  APP_LANGUAGES,
  chooseLanguage,
  toAppLanguage,
  type AppLanguage,
} from '@app/localization/appLanguage';
import { putCourierLanguage } from '@app/localization/languageApi';

type Props = MainScreenProp<MainScreens.LanguageScreen>;

// Spec 0054 (AC-1): Language, Ελληνικά or English. The upstream screen listed six languages the app never
// had and saved nothing. A tap switches the whole app at once, keeps the choice on the phone and tells the
// co-op's server (`PUT courier/language`), whose emails follow it. Row 84 will move this into the six
// settings; the setting itself is this screen.
export const LanguageScreen = ({ navigation }: Props) => {
  // `i18n.language` is the language on show; changing it re-renders every screen that uses `t`.
  const { t, i18n } = useTranslation();
  const current = toAppLanguage(i18n.language);
  const [notSent, setNotSent] = useState(false);

  const choose = async (language: AppLanguage) => {
    if (language === current) {
      return;
    }
    await chooseLanguage(language);
    try {
      await putCourierLanguage(language);
      setNotSent(false);
    } catch (error) {
      console.log('Could not send the language to the server', error);
      setNotSent(true);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('translations:language')}</Text>
        </View>
        <View style={styles.list}>
          <Text style={styles.explained}>
            {t('translations:language_explained')}
          </Text>
          {APP_LANGUAGES.map(language => (
            <SettingsCell
              key={language}
              style={styles.cell}
              // SettingsCell translates its title as a key; each name is its language's own.
              title={`language_name_${language}`}
              cellType={SettingsCellType.radioButton}
              onSelect={() => choose(language)}
              isSelected={language === current}
            />
          ))}
          {notSent ? (
            <Text style={styles.explained}>
              {t('translations:language_not_sent')}
            </Text>
          ) : null}
        </View>
      </ScreenSafeArea>
    </View>
  );
};
