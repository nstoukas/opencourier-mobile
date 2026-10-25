import React, { ReactElement, useState } from 'react';
import {
  View,
  SafeAreaView,
  Text,
  SectionListData,
  SectionList,
} from 'react-native';
import { styles } from './Accessibility.styles';
import { MainScreenProp, MainScreens } from '@app/navigation/main/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { useTranslation } from 'react-i18next';
import { AccessibilitySettingsOptions } from '@app/types/types';
import {
  SettingsCell,
  SettingsCellType,
} from '@app/components/SettingsCell/SettingsCell';

type Props = MainScreenProp<MainScreens.Accessibility>;

type SectionListItem = {
  cellType: SettingsCellType;
  cellData: AccessibilitySettingsOptions;
};

export const AccessibilityScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();

  // A partial map from every option to a switch value, since the list looks the form
  // up by any option, not only the six switches set here.
  const [form, setForm] = useState<
    Partial<Record<AccessibilitySettingsOptions, boolean>>
  >({
    [AccessibilitySettingsOptions.differentSounds]: false,
    [AccessibilitySettingsOptions.screenFlash]: false,
    [AccessibilitySettingsOptions.vibration]: false,
    [AccessibilitySettingsOptions.readingNotes]: false,
    [AccessibilitySettingsOptions.seatbeltReminder]: false,
    [AccessibilitySettingsOptions.deaf]: false,
  });

  const dataSource: SectionListData<SectionListItem>[] = [
    {
      data: [
        {
          cellType: SettingsCellType.plain,
          cellData: AccessibilitySettingsOptions.volume,
        },
        {
          cellType: SettingsCellType.plain,
          cellData: AccessibilitySettingsOptions.sound,
        },
        {
          cellType: SettingsCellType.plain,
          cellData: AccessibilitySettingsOptions.myLanguages,
        },
        {
          cellType: SettingsCellType.switch,
          cellData: AccessibilitySettingsOptions.differentSounds,
        },
      ],
      title: undefined,
    },
    {
      data: [
        {
          cellType: SettingsCellType.switch,
          cellData: AccessibilitySettingsOptions.screenFlash,
        },
        {
          cellType: SettingsCellType.switch,
          cellData: AccessibilitySettingsOptions.vibration,
        },
        {
          cellType: SettingsCellType.switch,
          cellData: AccessibilitySettingsOptions.readingNotes,
        },
      ],
      title: t('translations:requests'),
    },
    {
      data: [
        {
          cellType: SettingsCellType.switch,
          cellData: AccessibilitySettingsOptions.seatbeltReminder,
        },
        {
          cellType: SettingsCellType.switch,
          cellData: AccessibilitySettingsOptions.deaf,
        },
      ],
      title: t('translations:other'),
    },
  ];

  const cellSubtitleForSetting = (setting: AccessibilitySettingsOptions) => {
    switch (setting) {
      case AccessibilitySettingsOptions.volume:
        return 'default_volume_more';
      case AccessibilitySettingsOptions.sound:
        return 'default_sound_more';
      case AccessibilitySettingsOptions.myLanguages:
        return 'my_languages_more';
      case AccessibilitySettingsOptions.differentSounds:
        return 'enable_different_sounds_more';
      case AccessibilitySettingsOptions.screenFlash:
        return 'screen_flash_more';
      case AccessibilitySettingsOptions.vibration:
        return 'enable_vibration_more';
      case AccessibilitySettingsOptions.readingNotes:
        return 'reading_notes_more';
      case AccessibilitySettingsOptions.seatbeltReminder:
        return 'seatbelt_reminder_more';
      case AccessibilitySettingsOptions.deaf:
        return 'im_deaf_more';
    }
  };

  const onPress = (item: string) => {
    if (item === 'default_sound') {
      navigation.navigate(MainScreens.DefaultSound);
    }
    if (item === 'my_languages') {
      navigation.navigate(MainScreens.MyLanguages);
    }
    if (item === 'default_volume') {
      navigation.navigate(MainScreens.VolumeScreen);
    }
  };

  const renderItem = ({
    item,
    index,
    section,
  }: {
    item: SectionListItem;
    index: number;
    section: SectionListData<SectionListItem>;
  }): ReactElement => {
    return (
      <SettingsCell
        cellType={item.cellType}
        title={item.cellData}
        subtitle={cellSubtitleForSetting(item.cellData)}
        style={{ marginBottom: 16 }}
        onPress={onPress}
        switchValue={form[item.cellData] ?? false}
        onSwitchValueChange={isOn =>
          setForm({ ...form, [item.cellData]: isOn })
        }
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
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>{t('translations:accessibility')}</Text>
        </View>
        <SectionList
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          sections={dataSource}
          renderItem={renderItem}
          bounces={true}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          keyExtractor={(item, index) => index.toString()}
        />
      </SafeAreaView>
    </View>
  );
};
