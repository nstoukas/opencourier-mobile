import React, { useMemo } from 'react';
import {
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';
import { styles } from './HomeTabs.styles';
import { HomeTabItem } from '@app/types/types';
import { Colors } from '@app/styles/colors';
import { useTranslation } from 'react-i18next';
import { SCREEN_WIDTH } from '@app/utilities/constants';
import { generateBoxShadowStyle } from '@app/utilities/styles';

type Props = {
  style?: StyleProp<ViewStyle>;
  newCount: number;
  inProgressCount: number;
  selectedTab: HomeTabItem;
  onTabSelected: (tab: HomeTabItem) => void;
};

export const HomeTabs = ({
  style,
  newCount,
  inProgressCount,
  selectedTab,
  onTabSelected,
}: Props) => {
  const { t } = useTranslation();
  const tabs: HomeTabItem[] = [
    HomeTabItem.New,
    HomeTabItem.InProgress,
    HomeTabItem.History,
  ];

  const tabSelectedColor = (currentTab: HomeTabItem): string => {
    return currentTab === selectedTab ? Colors.white : Colors.black1;
  };

  const buttonBackgroundColor = (currentTab: HomeTabItem): string => {
    return currentTab === selectedTab ? Colors.black4 : Colors.transparent;
  };

  const buttonWidth = (tab: HomeTabItem) => {
    switch (tab) {
      case HomeTabItem.New:
        return (SCREEN_WIDTH - 144) * 0.26;
      case HomeTabItem.InProgress:
        return (SCREEN_WIDTH - 144) * 0.44;
      case HomeTabItem.History:
        return (SCREEN_WIDTH - 144) * 0.24;
    }
  };

  const TabItem = ({ tab }: { tab: HomeTabItem }) => {
    return (
      <TouchableOpacity
        style={[{ width: buttonWidth(tab) }]}
        onPress={() => onTabSelected(tab)}>
        <View
          style={[
            styles.containerTabText,
            { backgroundColor: buttonBackgroundColor(tab) },
            tab === selectedTab &&
              generateBoxShadowStyle(0, 1, 0.1, 2, 1, Colors.black),
          ]}>
          <Text
            style={[styles.textTab, { color: tabSelectedColor(tab) }]}
            adjustsFontSizeToFit
            numberOfLines={1}>
            {t(`translations:${tab}`)}
          </Text>
          {tab === HomeTabItem.New && newCount > 0 && (
            <View style={[styles.containerCount]}>
              <Text style={styles.textCount}>{newCount}</Text>
            </View>
          )}
          {tab === HomeTabItem.InProgress && inProgressCount > 0 && (
            <View style={[styles.containerCount]}>
              <Text style={styles.textCount}>{inProgressCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.tabs}>
        {tabs.map(tab => {
          // `key` must sit on the element returned by .map() — it tells React which list item
          // this is between renders. `tab` is the enum's string value ('new' | 'in_progress' |
          // 'history'), unique within this list and the same on every render.
          return <TabItem key={tab} tab={tab} />;
        })}
      </View>
    </View>
  );
};
