import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import {
  SettingsCell,
  SettingsCellType,
} from '@app/components/SettingsCell/SettingsCell';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { styles } from './Account.styles';

type Props = MainScreenProp<MainScreens.Account>;

// Each row: its title's translation key, the line under it, and the screen it opens.
const ROWS = [
  {
    title: 'change_password',
    subtitle: 'change_password_more',
    screen: MainScreens.ChangePassword,
  },
  {
    title: 'account_changes',
    subtitle: 'account_changes_more',
    screen: MainScreens.AccountChanges,
  },
  {
    title: 'licenses',
    subtitle: 'licenses_more',
    screen: MainScreens.Licences,
  },
] as const;

// Row 84: Settings holds only the six settings now, so the rider's account
// lives here, opened from the side menu: Change password and Changes by the
// co-op (spec 0051, which first put them under Settings) and the open source
// licences (the old Settings "Dev" section).
export const Account = ({ navigation }: Props) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title} accessibilityRole="header">
            {t('translations:account')}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {ROWS.map(row => (
            <SettingsCell
              key={row.title}
              style={styles.cell}
              title={row.title}
              subtitle={row.subtitle}
              cellType={SettingsCellType.plain}
              onPress={() => navigation.navigate(row.screen)}
            />
          ))}
        </ScrollView>
      </ScreenSafeArea>
    </View>
  );
};
