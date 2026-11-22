import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { styles } from './Settings.styles';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { DrawerScreenProp, DrawerScreens } from '@app/navigation/drawer/types';
import { MainScreens } from '@app/navigation/main/types';
import { useTranslation } from 'react-i18next';
import { MapLinkingOptions, SettingsOptions } from '@app/types/types';
import { OrderSetting } from '@app/types/enums';
import { getNavigationApp } from '@app/services/mapPreferences';
import { toAppLanguage } from '@app/localization/appLanguage';
import useUser from '@app/hooks/useUser';
import { useRingCheck } from '@app/hooks/useRingCheck';
import { hasRingProblem } from '@app/services/ringCheck';
import {
  SettingsCell,
  SettingsCellType,
} from '@app/components/SettingsCell/SettingsCell';

type Props = DrawerScreenProp<DrawerScreens.Settings>;

// Row 84 (wishlist item 35): Settings holds exactly six things, in this order.
// Each saves somewhere real and is used by its feature:
// - Language: on the phone and on the server (spec 0054).
// - Navigation app: on the phone, used by Navigate (spec 0018).
// - Offer sound and volume: kept by Android, used by every offer alert (row 58).
// - Auto accept: on the server (`deliverySetting`), used by the offer loop (spec 0020).
// - Emergency contact: on the server, seen by the co-op on an SOS (spec 0051).
// - Is my phone set up to ring?: a check, it saves nothing (value 5).
// The account rows moved to the side menu's Account screen; the rest saved nothing and is gone.
export const SETTINGS_ROWS = [
  SettingsOptions.language,
  SettingsOptions.navigation,
  SettingsOptions.offerSound,
  SettingsOptions.autoAccept,
  SettingsOptions.emergencyContact,
  SettingsOptions.ringCheck,
] as const;

export const SettingsScreen = ({ navigation }: Props) => {
  const { t, i18n } = useTranslation();
  const { user, updateDeliverySettings } = useUser();
  const { items: ringCheck } = useRingCheck();

  // Auto accept shows the server's value. While a change is on its way, the
  // switch shows the rider's choice; it goes back to the server's value once
  // that matches, or at once if the change fails (useUser says why).
  const savedAutoAccept = user?.deliverySetting === OrderSetting.auto_accept;
  const [pendingAutoAccept, setPendingAutoAccept] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    if (pendingAutoAccept !== null && pendingAutoAccept === savedAutoAccept) {
      setPendingAutoAccept(null);
    }
  }, [pendingAutoAccept, savedAutoAccept]);
  const autoAcceptShown = pendingAutoAccept ?? savedAutoAccept;

  const changeAutoAccept = (isOn: boolean) => {
    setPendingAutoAccept(isOn);
    updateDeliverySettings(
      isOn ? OrderSetting.auto_accept : OrderSetting.manual,
      // `mutate` takes callbacks for this one call, after the hook's own.
      { onError: () => setPendingAutoAccept(null) },
    );
  };

  // Spec 0018 (AC-12): the Navigation row shows the saved navigation app, read
  // again each time Settings comes into view (the rider may have just changed it).
  const [navigationApp, setNavigationAppShown] =
    useState<MapLinkingOptions | null>(null);
  useEffect(() => {
    const refresh = () => {
      getNavigationApp().then(setNavigationAppShown);
    };
    refresh();
    // `addListener` returns the function that removes the listener again.
    return navigation.addListener?.('focus', refresh);
  }, [navigation]);

  // The line under each row's title, as a translation key.
  const subtitleFor = (setting: (typeof SETTINGS_ROWS)[number]): string => {
    switch (setting) {
      case SettingsOptions.language:
        // The language on show, in its own name (spec 0054, AC-1).
        return `language_name_${toAppLanguage(i18n.language)}`;
      case SettingsOptions.navigation:
        // The app's name is its own translation key ('google_maps', 'waze'...).
        return navigationApp ?? 'navigation_app_ask';
      case SettingsOptions.offerSound:
        return 'offer_sound_more';
      case SettingsOptions.autoAccept:
        return 'auto_accept_more';
      case SettingsOptions.emergencyContact:
        return 'emergency_contact_more';
      case SettingsOptions.ringCheck:
        if (ringCheck === null) {
          return 'ring_check_checking';
        }
        return hasRingProblem(ringCheck)
          ? 'ring_check_needs_fixing'
          : 'ring_check_all_good';
    }
  };

  const onPressCell = (setting: string) => {
    switch (setting) {
      case SettingsOptions.language:
        navigation.navigate(MainScreens.LanguageScreen);
        break;
      case SettingsOptions.navigation:
        navigation.navigate(MainScreens.NavigationScreen);
        break;
      case SettingsOptions.offerSound:
        navigation.navigate(MainScreens.OfferSound);
        break;
      case SettingsOptions.emergencyContact:
        navigation.navigate(MainScreens.EmergencyContact);
        break;
      case SettingsOptions.ringCheck:
        navigation.navigate(MainScreens.RingCheck);
        break;
    }
  };

  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.toggleDrawer()} />
          <Text style={styles.title}>{t('translations:settings')}</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}>
          {SETTINGS_ROWS.map(setting =>
            setting === SettingsOptions.autoAccept ? (
              <SettingsCell
                key={setting}
                style={styles.cell}
                title={setting}
                subtitle={subtitleFor(setting)}
                cellType={SettingsCellType.switch}
                switchValue={autoAcceptShown}
                // No user loaded yet (no signal at start): nothing to change.
                onSwitchValueChange={user ? changeAutoAccept : undefined}
              />
            ) : (
              <SettingsCell
                key={setting}
                style={styles.cell}
                title={setting}
                subtitle={subtitleFor(setting)}
                cellType={SettingsCellType.plain}
                onPress={onPressCell}
              />
            ),
          )}
        </ScrollView>
      </ScreenSafeArea>
    </View>
  );
};
