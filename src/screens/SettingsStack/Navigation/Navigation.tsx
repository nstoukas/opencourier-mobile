import React, { useState } from 'react';
import {
  View,
  SafeAreaView,
  Text,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { styles } from './Navigation.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useTranslation } from 'react-i18next';
import { Colors } from '@app/styles/colors';
import { touchRow } from '@app/utilities/touch';

type Props = MainScreenProp<MainScreens.NavigationScreen>;

export const NavigationScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [switchOn, setSwitchOn] = useState<boolean>(false);
  const [selectedApp, setSelectedApp] = useState<'apple' | 'google' | 'waze'>(
    'apple',
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('translations:navigation')}</Text>
        </View>
        <View style={styles.containerHorizontal}>
          <View style={styles.containerText}>
            <Text style={styles.textSectionTitle}>
              {t('translations:auto_copy')}
            </Text>
            <Text style={styles.textInfo}>
              {t('translations:enable_auto_copy')}
            </Text>
          </View>
          <Switch value={switchOn} onValueChange={setSwitchOn} />
        </View>
        <Text style={styles.textSectionTitle}>
          {t('translations:preferred_nav')}
        </Text>
        <View style={styles.containerGray}>
          <TouchableOpacity
            onPress={() => setSelectedApp('apple')}
            style={[
              touchRow,
              styles.button,
              selectedApp === 'apple' && { backgroundColor: Colors.white },
            ]}>
            <Text style={styles.textButton}>{t('translations:apple')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedApp('google')}
            style={[
              touchRow,
              styles.button,
              selectedApp === 'google' && { backgroundColor: Colors.white },
            ]}>
            <Text style={styles.textButton}>{t('translations:google')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedApp('waze')}
            style={[
              touchRow,
              styles.button,
              selectedApp === 'waze' && { backgroundColor: Colors.white },
            ]}>
            <Text style={styles.textButton}>{t('translations:waze')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};
