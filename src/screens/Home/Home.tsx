import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  FlatList,
  Linking,
  RefreshControl,
  View,
} from 'react-native';
import { styles } from './Home.styles';
import { HomeHeader } from '@app/components/HomeHeader/HomeHeader';
import {
  Comment,
  CourierTip,
  HomeEmptyState,
  HomeTabItem,
  MapDestination,
  Order,
  UserStatus,
} from '@app/types/types';
import { HomeEmptyStateComponent } from '@app/components/HomeEmptyState/HomeEmptyState';
import { DrawerScreenProp, DrawerScreens } from '@app/navigation/drawer/types';
import { HistoryCell } from '@app/components/HistoryCell/HistoryCell';
import { NewOrderCell } from '@app/components/NewOrderCell/NewOrderCell';
import { InProgressCell } from '@app/components/InProgressCell/InProgressCell';
import ActionSheet from 'react-native-action-sheet';
import { MainScreens } from '@app/navigation/main/types';
import Clipboard from '@react-native-clipboard/clipboard';
import { useHomeOrders } from '@app/hooks/useHomeOrders';
import { useTranslation } from 'react-i18next';
import { ReportAnIncident } from '@app/components/ReportAnIncident/ReportAnIncident';
import { OrderSetting, OrderStatus } from '@app/types/enums';
import ButtonSwipe from '@app/components/ButtonSwipe/ButtonSwipe';
import { SkeletonOrderHistoryCell } from '@app/components/SkeletonOrderHistoryCell/SkeletonOrderHistoryCell';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useUser from '@app/hooks/useUser';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useConnectionStatus } from '@app/services/socket';
import { prepareToGoOnline } from '@app/services/offerPush/goOnlineChecks';
import { cancelOfferAlert } from '@app/services/offerPush/offerAlert';
import { isHomeInFront } from '@app/navigation/navigationRef';
import { color } from '@app/styles/theme';
import { mapAppsFor, mapProbeUrl, mapRouteUrl } from '@app/utilities/mapLinks';

type Props = DrawerScreenProp<DrawerScreens.Home>;

export const HomeScreen = ({ navigation }: Props) => {
  const { bottom } = useSafeAreaInsets();

  const [reportIncidentDismissed, setReportIncidentDismissed] =
    useState<boolean>(false);
  const { t } = useTranslation();
  const { user, isLoading, updateStatus } = useUser();
  const connectionStatus = useConnectionStatus();
  const [availableMapApps, setAvailableMapApps] = useState<string[]>([
    t('translations:cancel'),
  ]);
  const [selectedTab, setSelectedTab] = useState<HomeTabItem>(HomeTabItem.New);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  const [dataSource, setDataSource] = useState<Order[]>([]);
  // `?.` because Home can render for a moment with no user (logging out, or a session
  // that just ended); `user!` crashed there.
  const autoAcceptOrders = user?.deliverySetting === OrderSetting.auto_accept;

  const [showMapActionSheet, setShowMapActionSheet] = useState<
    { order: Order; destination: MapDestination } | undefined
  >(undefined);
  const [orderDeliveredNotif, setOrderDeliveredNotif] =
    useState<boolean>(false);
  const {
    dataSourceNew,
    dataSourceHistory,
    dataSourceInProgress,
    timeLeftForOffer,
    totalTimeForOffer,
    waitedTimeForOffer,
    refetchNew,
    refetchInProgress,
    refechHistory,
    declineOrderFn,
    acceptOrderFn,
    //TEMP upvote/downvote fix
    isLoading: isLoadingOrders,
  } = useHomeOrders();

  useFocusEffect(() => {
    refetchInProgress();
    refechHistory();
  });

  // AC-12: while this list is in front, an offer it shows needs no system
  // alert as well. An alert posted while the phone was locked, or while
  // another screen was in front, stops ringing once the rider is here.
  // `useIsFocused` is true while this screen is the one in front; the offer
  // screen can still be open over it (isHomeInFront checks that too).
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) {
      return;
    }
    const quietShownOffers = async () => {
      if (await isHomeInFront()) {
        dataSourceNew.forEach(order => cancelOfferAlert(order.id));
      }
    };
    quietShownOffers();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        quietShownOffers();
      }
    });
    return () => subscription.remove();
  }, [isFocused, dataSourceNew]);

  const onProfilePress = () => {
    navigation.toggleDrawer();
  };

  const emptyState = useMemo(() => {
    switch (selectedTab) {
      case HomeTabItem.New:
        return user!.status === UserStatus.Online
          ? HomeEmptyState.WaitingNewOrders
          : HomeEmptyState.New;
      case HomeTabItem.InProgress:
        return HomeEmptyState.InProgress;
      case HomeTabItem.History:
        return HomeEmptyState.History;
    }
  }, [selectedTab, user!.status]);

  const showEmptyState = useMemo(() => {
    switch (selectedTab) {
      case HomeTabItem.New:
        return dataSourceNew.length === 0;
      case HomeTabItem.InProgress:
        return dataSourceInProgress.length === 0;
      case HomeTabItem.History:
        return dataSourceHistory.length === 0;
    }
  }, [selectedTab, dataSourceHistory, dataSourceNew, dataSourceInProgress]);

  const onGoOnline = async (didSwipe: boolean) => {
    if (!didSwipe) {
      return;
    }

    // The first time, ask for the alert permissions; every time, warn if the
    // phone is on silent (spec 0003, AC-8, AC-9). Either answer goes Online.
    await prepareToGoOnline();
    updateStatus(UserStatus.Online);
  };

  const renderItem = ({ item }: { item: Order }) => {
    switch (selectedTab) {
      case HomeTabItem.New:
        return (
          <NewOrderCell
            millisRemaining={timeLeftForOffer(item.id)}
            totalMillis={totalTimeForOffer(item.id)}
            millisWaited={waitedTimeForOffer(item.id)}
            autoAcceptOrders={autoAcceptOrders}
            order={item}
            onAccept={order => acceptOrderFn(order.id)}
            onDecline={order => declineOrderFn(order.id)}
            onCopyCustomer={order =>
              Clipboard.setString(
                order.dropoffLocationFormattedAddress ??
                  order.dropoffLocation?.formattedAddress ??
                  '',
              )
            }
            onCopyRestaurant={order =>
              Clipboard.setString(
                order.pickupLocationFormattedAddress ??
                  order.pickupLocation?.formattedAddress ??
                  '',
              )
            }
          />
        );
      case HomeTabItem.InProgress:
        //TODO: TEMP FIX
        // if (item.dropoff.location === undefined) {
        //   return <View />;
        // }
        return (
          <InProgressCell
            onMessageCustomer={order =>
              Clipboard.setString(
                order.dropoffLocationFormattedAddress ??
                  order.dropoffLocation?.formattedAddress ??
                  '',
              )
            }
            onMessageRestaurant={order =>
              Clipboard.setString(
                order.pickupLocationFormattedAddress ??
                  order.pickupLocation?.formattedAddress ??
                  '',
              )
            }
            onCallCustomer={() =>
              Linking.openURL(`tel://${item.dropoffPhoneNumber}`)
            }
            onCallRestaurant={() =>
              Linking.openURL(`tel://${item.pickupPhoneNumber}`)
            }
            order={item}
            onRestaurantAddressPress={order =>
              setShowMapActionSheet({
                order: order,
                destination: MapDestination.restaurant,
              })
            }
            onCustomerAddressPress={order =>
              setShowMapActionSheet({
                order: order,
                destination: MapDestination.customer,
              })
            }
            onOrderItemsListForCustomer={() => {
              navigation.navigate(MainScreens.ItemsCollected, {
                customerName: item.dropoffName,
                items: item.orderItems,
              });
            }}
            onReportIssue={order =>
              navigation.navigate(MainScreens.ReportIssue, { order: order })
            }
          />
        );
      case HomeTabItem.History:
        return <HistoryCell order={item} onPress={() => undefined} />;
    }
  };

  const onSelect = (buttonIndex: number) => {
    const { order, destination } = showMapActionSheet ?? {
      order: undefined,
      destination: undefined,
    };
    if (
      order !== undefined &&
      order.pickupLocation !== undefined &&
      order.dropoffLocation !== undefined &&
      destination !== undefined
    ) {
      // Route to the place the rider tapped: the customer or the restaurant.
      const point =
        destination === MapDestination.customer
          ? order.dropoffLocation
          : order.pickupLocation;
      const app = mapAppsFor().find(
        option => availableMapApps[buttonIndex] === t(`translations:${option}`),
      );
      if (app !== undefined) {
        Linking.openURL(mapRouteUrl(app, point)).catch(error =>
          console.log('Could not open the map app', error),
        );
      }
    }
    setShowMapActionSheet(undefined);
  };

  const showActionSheeet = (_order: Order) => {
    ActionSheet.showActionSheetWithOptions(
      {
        options: availableMapApps,
        cancelButtonIndex: Math.max(0, availableMapApps.length - 1),
        tintColor: color.route,
        cancelButtonTintColor: color.destructive,
      },
      onSelect,
    );
  };

  const onRefresh = () => {
    switch (selectedTab) {
      case HomeTabItem.New:
        user?.status == UserStatus.Online && refetchNew();
        break;
      case HomeTabItem.InProgress:
        refetchInProgress();
        break;
      case HomeTabItem.History:
        refechHistory();
        break;
    }
  };

  const checkInstalledMapApps = async () => {
    const maps: string[] = [];
    for (const app of mapAppsFor()) {
      if (await Linking.canOpenURL(mapProbeUrl(app))) {
        maps.push(t(`translations:${app}`));
      }
    }
    maps.push(t('translations:cancel'));
    setAvailableMapApps(maps);
  };

  useEffect(() => {
    switch (selectedTab) {
      case HomeTabItem.New:
        setDataSource(dataSourceNew);
        break;
      case HomeTabItem.InProgress:
        setDataSource(dataSourceInProgress);
        break;
      case HomeTabItem.History:
        setDataSource(dataSourceHistory);
        break;
    }
  }, [selectedTab, dataSourceHistory, dataSourceNew, dataSourceInProgress]);

  useEffect(() => {
    (async () => {
      // const accept = await getAutoAcceptOrdersStorage();
      // setAutoAcceptOrders(accept);
      checkInstalledMapApps();
    })();
  }, []);

  const ListEmptyComponent = useCallback(() => {
    if (isLoading) {
      return <HistorySkeleton />;
    } else {
      return <HomeEmptyStateComponent state={emptyState} />;
    }
  }, [HistorySkeleton, emptyState, isLoading]);

  const HistorySkeleton = useCallback(() => {
    if (
      selectedTab === HomeTabItem.History &&
      dataSource.length === 0 &&
      !isLoadingOrders
    ) {
      return (
        <>
          <SkeletonOrderHistoryCell />
          <SkeletonOrderHistoryCell />
          <SkeletonOrderHistoryCell />
        </>
      );
    } else {
      return null;
    }
  }, [dataSource.length, isLoadingOrders, selectedTab]);

  return (
    <View style={styles.container} testID="home-screen">
      <HomeHeader
        orderDeliveredNotification={orderDeliveredNotif}
        onCloseOrderDeliveredNotification={() =>
          setOrderDeliveredNotif(!orderDeliveredNotif)
        }
        userStatus={user!.status}
        selectedTab={selectedTab}
        onProfile={onProfilePress}
        onSearch={setIsSearching}
        onTabSelected={setSelectedTab}
        newCount={dataSourceNew.length}
        inProgressCount={dataSourceInProgress.length}
        searchShown={isSearching}
        searchText={searchText}
        onSearchTextChange={setSearchText}
        loadingNewOrders={selectedTab === HomeTabItem.New && isLoadingOrders}
        connectionStatus={connectionStatus}
      />
      {selectedTab === HomeTabItem.History && !reportIncidentDismissed && (
        <ReportAnIncident onDismiss={() => setReportIncidentDismissed(true)} />
      )}

      <FlatList
        // Key each row by its delivery id and offer time, so a row (and its
        // countdown bar) stays with its own offer when the list changes, and a
        // new offer of the same delivery gets a fresh row.
        keyExtractor={item => `${item.id}-${item.offeredAt ?? ''}`}
        data={dataSource}
        renderItem={renderItem}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl refreshing={isLoadingOrders} onRefresh={onRefresh} />
        }
      />

      {user?.status !== UserStatus.Online && (
        <ButtonSwipe
          style={{ position: 'absolute', bottom: bottom + 16 }}
          isSwiped={false}
          onSwiped={onGoOnline}
          enabled={true}
          title={t('translations:go_online')}
          subtitle={t('translations:slide_to_start')}
          isLoading={isLoading ?? false}
        />
      )}

      <>
        {showMapActionSheet !== undefined &&
          showActionSheeet(showMapActionSheet.order)}
      </>
    </View>
  );
};
