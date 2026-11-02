import React, { useEffect, useState } from 'react';
import { View, SafeAreaView, Text, TouchableOpacity } from 'react-native';
import { styles } from './Navigation.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useTranslation } from 'react-i18next';
import { color } from '@app/styles/theme';
import { touchRow } from '@app/utilities/touch';
import { MapLinkingOptions } from '@app/types/types';
import {
  getNavigationApp,
  setNavigationApp,
} from '@app/services/mapPreferences';
import { installedNavigationApps } from '@app/hooks/useNavigateTo';

type Props = MainScreenProp<MainScreens.NavigationScreen>;

// Spec 0018 (AC-12): the navigation app Navigate opens, saved on this phone.
// "Ask every time" clears it. Only the apps this phone has are offered. (This
// screen used to show a choice and an "auto copy" switch that saved nothing.)
export const NavigationScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [installed, setInstalled] = useState<MapLinkingOptions[]>([]);
  const [selectedApp, setSelectedApp] = useState<MapLinkingOptions | null>(
    null,
  );

  useEffect(() => {
    installedNavigationApps().then(setInstalled);
    getNavigationApp().then(setSelectedApp);
  }, []);

  const choose = (app: MapLinkingOptions | null) => {
    setSelectedApp(app);
    setNavigationApp(app).catch(() => undefined);
  };

  const option = (
    key: string,
    label: string,
    app: MapLinkingOptions | null,
  ) => (
    <TouchableOpacity
      key={key}
      testID={`navigation-app-${key}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selectedApp === app }}
      onPress={() => choose(app)}
      style={[
        touchRow,
        styles.button,
        selectedApp === app && { backgroundColor: color.card },
      ]}>
      <Text style={styles.textButton}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('translations:navigation')}</Text>
        </View>
        <Text style={styles.textSectionTitle}>
          {t('translations:navigation_app_title')}
        </Text>
        <View style={styles.containerGray}>
          {installed.map(app => option(app, t(`translations:${app}`), app))}
          {option('ask', t('translations:navigation_app_ask'), null)}
        </View>
      </SafeAreaView>
    </View>
  );
};
