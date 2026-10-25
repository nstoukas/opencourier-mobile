import React from 'react';
import { StyleProp, ViewStyle, View, Text, Platform } from 'react-native';
import { styles } from './HomeHeader.styles';
import { HomeTabItem, ToastMessage, UserStatus } from '@app/types/types';
import { ProfileBadge } from '../ProfileBadge/ProfileBadge';
import { ButtonSearch } from '../ButtonSearch/ButtonSearch';
import { Colors } from '@app/styles/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { HomeTabs } from '../HomeTabs/HomeTabs';
import { SearchBar } from '../SearchBar/SearchBar';
import { WaitingForOrders } from '../WaitingForOrders/WaitingForOrders';
import { OrderDelivered } from '../OrderDelivered/OrderDelivered';
import { useTranslation } from 'react-i18next';
import { Toast } from '../Toast/Toast';
import { ConnectionDot } from '../ConnectionDot/ConnectionDot';
import { ConnectionStatus } from '@app/services/liveConnection';

type Props = {
  style?: StyleProp<ViewStyle>;
  onProfile: () => void;
  onTabSelected: (tab: HomeTabItem) => void;
  onSearch: (toggled: boolean) => void;
  selectedTab: HomeTabItem;
  userStatus: UserStatus;
  newCount: number;
  inProgressCount: number;
  searchShown: boolean;
  onSearchTextChange: (text: string) => void;
  searchText: string;
  orderDeliveredNotification: boolean;
  onCloseOrderDeliveredNotification: () => void;
  loadingNewOrders: boolean;
  connectionStatus: ConnectionStatus;
};

export const HomeHeader = ({
  style,
  onProfile,
  onTabSelected,
  onSearch,
  selectedTab,
  userStatus,
  newCount,
  inProgressCount,
  searchShown,
  onSearchTextChange,
  searchText,
  orderDeliveredNotification = false,
  onCloseOrderDeliveredNotification,
  loadingNewOrders,
  connectionStatus,
}: Props) => {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.content,
        style,
        { paddingTop: top + (Platform.OS === 'android' ? 10 : 0) },
      ]}>
      {userStatus === UserStatus.Online && (
        <LinearGradient
          style={[styles.gradient, { height: top + 50 }]}
          colors={Colors.onlineGradientArray}
        />
      )}
      {userStatus !== UserStatus.Online && (
        <LinearGradient
          style={[styles.gradient, { height: top + 50 }]}
          colors={Colors.offlineGradientArray}
        />
      )}
      {/* {loadingNewOrders && <WaitingForOrders style={styles.waiting} />}

      {orderDeliveredNotification && (
        <OrderDelivered
          onClose={onCloseOrderDeliveredNotification}
          style={styles.orderDelivered}
        />
      )} */}

      {/* <Toast toast={ToastMessage.addressCopied} /> */}
      {/* <Toast toast={ToastMessage.enableLocationServices} />
      <Toast toast={ToastMessage.enableNotifications} />
      <Toast toast={ToastMessage.itemsBagged} />
      <Toast toast={ToastMessage.pickupBeforeContinuing} /> */}

      <View style={styles.containerButtons}>
        <ProfileBadge userStatus={userStatus} onPress={onProfile} />
        <HomeTabs
          newCount={newCount}
          inProgressCount={inProgressCount}
          onTabSelected={onTabSelected}
          selectedTab={selectedTab}
        />
        <ButtonSearch onPress={onSearch} isSearching={searchShown} />
      </View>

      <ConnectionDot status={connectionStatus} />

      {searchShown && (
        <SearchBar
          style={styles.searchBar}
          text={searchText}
          onTextChange={onSearchTextChange}
        />
      )}
    </View>
  );
};
