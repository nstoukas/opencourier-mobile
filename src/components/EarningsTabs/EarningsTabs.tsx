import React from 'react';
import {
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';
import { styles } from './EarningsTabs.styles';
import { EarningsTabItem } from '@app/types/types';
import { Colors } from '@app/styles/colors';
import { useTranslation } from 'react-i18next';

type Props = {
  style?: StyleProp<ViewStyle>;
  selectedTab: EarningsTabItem;
  onTabSelected: (tab: EarningsTabItem) => void;
};

export const EarningsTabs = ({ style, selectedTab, onTabSelected }: Props) => {
  const { t } = useTranslation();
  const tabs: EarningsTabItem[] = [
    EarningsTabItem.Today,
    EarningsTabItem.Weekly,
    EarningsTabItem.All,
  ];

  const tabSelectedColor = (currentTab: EarningsTabItem): string => {
    return currentTab === selectedTab ? Colors.black1 : Colors.gray2;
  };

  const TabItem = ({ tab }: { tab: EarningsTabItem }) => {
    return (
      <TouchableOpacity style={styles.tab} onPress={() => onTabSelected(tab)}>
        <View style={styles.containerTabText}>
          <Text style={[styles.textTab, { color: tabSelectedColor(tab) }]}>
            {t(`translations:${tab}`)}
          </Text>
        </View>
        {selectedTab === tab && <View style={styles.indicator} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.tabs}>
        {tabs.map(tab => {
          // Each tab is a different value, so the tab itself is its key.
          return <TabItem key={tab} tab={tab} />;
        })}
      </View>
    </View>
  );
};
