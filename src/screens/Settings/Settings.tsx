import React, { ReactElement, useEffect, useState } from 'react';
import { View, Text, SectionListData, SectionList } from 'react-native';
import { ScreenSafeArea } from '@app/components/ScreenSafeArea/ScreenSafeArea';
import { styles } from './Settings.styles';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { DrawerScreenProp, DrawerScreens } from '@app/navigation/drawer/types';
import { MainScreens } from '@app/navigation/main/types';
import { useTranslation } from 'react-i18next';
import messaging from '@react-native-firebase/messaging';
import Clipboard from '@react-native-clipboard/clipboard';
import { MapLinkingOptions, SettingsOptions } from '@app/types/types';
import { getNavigationApp } from '@app/services/mapPreferences';
import {
  SettingsCell,
  SettingsCellType,
} from '@app/components/SettingsCell/SettingsCell';

type SectionListItem = {
  cellType: SettingsCellType;
  cellData: SettingsOptions;
};

type Props = DrawerScreenProp<DrawerScreens.Settings>;

export const SettingsScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [token, setToken] = useState<string>('');

  // Typed as a partial map from every option to a switch value, because the list
  // below looks the form up by any option, not only the two switches set here.
  const [form, setForm] = useState<Partial<Record<SettingsOptions, boolean>>>({
    [SettingsOptions.notifications]: false,
    [SettingsOptions.cashOnDelivery]: false,
  });

  const settings: SectionListData<SectionListItem>[] = [
    {
      data: [
        {
          cellType: SettingsCellType.plain,
          cellData: SettingsOptions.accountInformation,
        },
        {
          cellType: SettingsCellType.plain,
          cellData: SettingsOptions.emergencyContact,
        },
        {
          cellType: SettingsCellType.plain,
          cellData: SettingsOptions.language,
        },
        {
          cellType: SettingsCellType.plain,
          cellData: SettingsOptions.navigation,
        },
        {
          cellType: SettingsCellType.plain,
          cellData: SettingsOptions.operatingArea,
        },
        {
          cellType: SettingsCellType.plain,
          cellData: SettingsOptions.vehicleType,
        },
        {
          cellType: SettingsCellType.plain,
          cellData: SettingsOptions.verification,
        },
        {
          cellType: SettingsCellType.switch,
          cellData: SettingsOptions.notifications,
        },
        {
          cellType: SettingsCellType.switch,
          cellData: SettingsOptions.cashOnDelivery,
        },
      ],
      title: undefined,
    },
    {
      data: [
        {
          cellType: SettingsCellType.plain,
          cellData: SettingsOptions.shiftAvailability,
        },
      ],
      title: t('translations:orders'),
    },
    {
      data: [
        {
          cellData: SettingsOptions.licenses,
          cellType: SettingsCellType.plain,
        },
      ],
      title: t('translations:Dev'),
    },
  ];

  const pullToken = async () => {
    const fcmToken = await messaging().getToken();
    setToken(fcmToken);
  };

  const onTokenPressHandle = () => {
    Clipboard.setString(token);
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

  const cellSubtitleForSetting = (setting: SettingsOptions) => {
    switch (setting) {
      case SettingsOptions.accountInformation:
        return 'manage_your_account';
      case SettingsOptions.emergencyContact:
        return 'add_trusted_contact';
      case SettingsOptions.language:
        return 'select_language';
      case SettingsOptions.navigation:
        // The app's name is its own translation key ('google_maps', 'waze'...).
        return navigationApp ?? 'navigation_app_ask';
      case SettingsOptions.operatingArea:
        return 'manage_you_areas';
      case SettingsOptions.verification:
        return 'manage_verification';
      case SettingsOptions.notifications:
        return 'push_notifications';
      case SettingsOptions.cashOnDelivery:
        return 'enable_cash';
      case SettingsOptions.licenses:
        return undefined;
      case SettingsOptions.vehicleType:
        return 'select_vehicle';
      case SettingsOptions.shiftAvailability:
        return 'shift_availability_more';
    }
  };

  const onPressCell = (item: string) => {
    if (item === SettingsOptions.licenses) {
      navigation.navigate(MainScreens.Licences);
    }
    if (item === SettingsOptions.language) {
      navigation.navigate(MainScreens.LanguageScreen);
    }
    if (item === SettingsOptions.operatingArea) {
      navigation.navigate(MainScreens.OperatingArea);
    }
    if (item === SettingsOptions.emergencyContact) {
      navigation.navigate(MainScreens.EmergencyContact);
    }
    if (item === SettingsOptions.navigation) {
      navigation.navigate(MainScreens.NavigationScreen);
    }
    if (item === SettingsOptions.vehicleType) {
      navigation.navigate(MainScreens.VehicleTypeScreen);
    }
    if (item === SettingsOptions.shiftAvailability) {
      navigation.navigate(MainScreens.ShiftAvailabilityScreen);
    }
  };
  const renderItem = ({
    item,
    index,
  }: {
    item: SectionListItem;
    index: number;
  }) => {
    return (
      <SettingsCell
        style={{ marginBottom: 16 }}
        title={item.cellData}
        subtitle={cellSubtitleForSetting(item.cellData)}
        cellType={item.cellType}
        onPress={onPressCell}
        switchValue={form[item.cellData] ?? false}
        onSwitchValueChange={isOn => {
          setForm({
            ...form,
            [item.cellData]: isOn,
          });
        }}
      />
    );
  };

  const renderSectionHeader = ({
    section: { title, data },
  }: {
    section: SectionListData<SectionListItem>;
  }): ReactElement => {
    if (title) {
      return (
        <View style={styles.containerHeader}>
          <Text style={styles.headerText}>{title}</Text>
          <View style={styles.headerLine} />
        </View>
      );
    }
    return <></>;
  };

  return (
    <View style={styles.container}>
      <ScreenSafeArea style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.toggleDrawer()} />
          <Text style={styles.title}>{t('translations:settings')}</Text>
        </View>

        {/* {token && (
          <TouchableOpacity onPress={onTokenPressHandle}>
            <Text style={{ color: 'black', padding: 20 }}>
              FCM Token: {token}
            </Text>
          </TouchableOpacity>
        )} */}

        <SectionList
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          sections={settings}
          renderItem={renderItem}
          bounces={true}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          keyExtractor={(item, index) => index.toString()}
        />
      </ScreenSafeArea>
    </View>
  );
};
