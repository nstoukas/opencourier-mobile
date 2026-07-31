import React from 'react';
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

const tabs: HomeTabItem[] = [
  HomeTabItem.New,
  HomeTabItem.InProgress,
  HomeTabItem.History,
];

// Pure helper: how wide each tab is. Depends only on its argument and the screen width,
// so it belongs at module scope, not re-created inside the component on every render.
export const buttonWidth = (tab: HomeTabItem) => {
  switch (tab) {
    case HomeTabItem.New:
      return (SCREEN_WIDTH - 144) * 0.26;
    case HomeTabItem.InProgress:
      return (SCREEN_WIDTH - 144) * 0.44;
    case HomeTabItem.History:
      return (SCREEN_WIDTH - 144) * 0.24;
  }
};

// The colour of a tab's label: white when it is the selected tab, dark otherwise.
export const tabSelectedColor = (
  currentTab: HomeTabItem,
  selectedTab: HomeTabItem,
): string => (currentTab === selectedTab ? Colors.white : Colors.black1);

// The pill behind the selected tab; every other tab is transparent.
export const buttonBackgroundColor = (
  currentTab: HomeTabItem,
  selectedTab: HomeTabItem,
): string => (currentTab === selectedTab ? Colors.black4 : Colors.transparent);

type TabItemProps = {
  tab: HomeTabItem;
  selectedTab: HomeTabItem;
  newCount: number;
  inProgressCount: number;
  onTabSelected: (tab: HomeTabItem) => void;
};

// Declared at module scope, not inside HomeTabs. A component declared inside another
// component is a new function on every parent render, so React remounts it instead of
// updating it.
const TabItem = ({
  tab,
  selectedTab,
  newCount,
  inProgressCount,
  onTabSelected,
}: TabItemProps) => {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={[{ width: buttonWidth(tab) }]}
      onPress={() => onTabSelected(tab)}>
      <View
        style={[
          styles.containerTabText,
          { backgroundColor: buttonBackgroundColor(tab, selectedTab) },
          tab === selectedTab &&
            generateBoxShadowStyle(0, 1, 0.1, 2, 1, Colors.black),
        ]}>
        <Text
          style={[
            styles.textTab,
            { color: tabSelectedColor(tab, selectedTab) },
          ]}
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

export const HomeTabs = ({
  style,
  newCount,
  inProgressCount,
  selectedTab,
  onTabSelected,
}: Props) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.tabs}>
        {tabs.map(tab => {
          // `key` must sit on the element returned by .map() — it tells React which list item
          // this is between renders. `tab` is the enum's string value ('new' | 'in_progress' |
          // 'history'), unique within this list and the same on every render.
          return (
            <TabItem
              key={tab}
              tab={tab}
              selectedTab={selectedTab}
              newCount={newCount}
              inProgressCount={inProgressCount}
              onTabSelected={onTabSelected}
            />
          );
        })}
      </View>
    </View>
  );
};
