import React, { useState } from 'react';
import {
  View,
  SafeAreaView,
  Text,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { styles } from './MyLanguages.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@app/utilities/constants';
import { Language } from '@app/types/types';
import {
  SettingsCell,
  SettingsCellType,
} from '@app/components/SettingsCell/SettingsCell';
import { generateBoxShadowStyle } from '@app/utilities/styles';
import { Colors } from '@app/styles/colors';
import { Button, ButtonType } from '@app/components/Button/Button';
import { typeScale } from '@app/styles/theme';
import { hitSlopFor } from '@app/utilities/touch';
import { Icon } from '@app/components/Icon/Icon';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { XIcon } from 'phosphor-react-native/src/icons/X';

type Props = MainScreenProp<MainScreens.MyLanguages>;

export const MyLanguages = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [infoShown, setInfoShown] = useState<boolean>(true);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([
    SUPPORTED_LANGUAGES[1].name,
    SUPPORTED_LANGUAGES[3].name,
  ]);
  const languages = SUPPORTED_LANGUAGES;

  const onSelectLanguage = (lang: string) => {
    if (selectedLanguages.filter(obj => obj === lang).length > 0) {
      setSelectedLanguages(selectedLanguages.filter(obj => obj !== lang));
    } else {
      const newLangs = [...selectedLanguages];
      newLangs.push(lang);
      setSelectedLanguages(newLangs);
    }
  };

  const renderItem = ({ item, index }: { item: Language; index: number }) => {
    return (
      <SettingsCell
        style={{ marginBottom: 16 }}
        title={item.name}
        subtitle={`(${item.abreviation})`}
        cellType={SettingsCellType.radioButton}
        onSelect={onSelectLanguage}
        isSelected={
          selectedLanguages.filter(obj => obj === item.name).length > 0
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('translations:my_languages')}</Text>
        </View>
        {infoShown && (
          <View
            style={[
              styles.card,
              generateBoxShadowStyle(0, 10, 0.08, 12, 20, Colors.black8),
            ]}>
            <View style={styles.cardHeader}>
              <Icon icon={InfoIcon} weight="fill" style={styles.image} />
              <Text style={styles.cardTitle}>
                {t('translations:languages_i_know')}
              </Text>
              <TouchableOpacity
                hitSlop={hitSlopFor(20)}
                onPress={() => setInfoShown(false)}>
                <Icon icon={XIcon} size={20} />
              </TouchableOpacity>
            </View>
            <Text style={styles.cardText}>
              {t('translations:languages_i_know_info')}
            </Text>
            <View style={styles.buttonsContainer}>
              <Button
                title={t('translations:language')}
                textStyle={{ fontSize: typeScale['body-sm'].fontSize }}
                style={{ width: 116 }}
                onPress={() => {
                  setInfoShown(false);
                  navigation.navigate(MainScreens.LanguageScreen);
                }}
                type={ButtonType.grayBGBlackText}
              />
              <Button
                title={t('translations:dismiss')}
                textStyle={{ fontSize: typeScale['body-sm'].fontSize }}
                style={{ width: 77, marginLeft: 16 }}
                onPress={() => setInfoShown(false)}
                type={ButtonType.white}
              />
            </View>
          </View>
        )}
        <FlatList
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyExtractor={(item, index) => index.toString()}
          data={languages}
          renderItem={renderItem}
        />
      </SafeAreaView>
    </View>
  );
};
