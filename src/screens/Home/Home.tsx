import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import ActionSheet from 'react-native-action-sheet';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { styles } from './Home.styles';
import { DispatchStopBanner } from '@app/components/DispatchStopBanner/DispatchStopBanner';
import { ShiftBanner } from '@app/components/ShiftBanner/ShiftBanner';
import { CancelledJobCard } from '@app/components/CancelledJobCard/CancelledJobCard';
import { RefusedSteps } from '@app/components/RefusedSteps/RefusedSteps';
import { NewOrderCell } from '@app/components/NewOrderCell/NewOrderCell';
import { InProgressCell } from '@app/components/InProgressCell/InProgressCell';
import { JobFooter } from '@app/components/JobFooter/JobFooter';
import { RouteMap } from '@app/components/RouteMap/RouteMap';
import { HomeTopSlot } from '@app/components/HomeTopSlot/HomeTopSlot';
import { HomeCard, HomeCardMode } from '@app/components/HomeCard/HomeCard';
import { Order, UserStatus } from '@app/types/types';
import { OrderSetting, OrderStatus } from '@app/types/enums';
import { RoutePoint } from '@app/types/route';
import { DrawerScreenProp, DrawerScreens } from '@app/navigation/drawer/types';
import { MainScreens } from '@app/navigation/main/types';
import { RootScreen } from '@app/navigation/types';
import { useHomeOrders } from '@app/hooks/useHomeOrders';
import useUser from '@app/hooks/useUser';
import { useConnectionStatus } from '@app/services/socket';
import { prepareToGoOnline } from '@app/services/offerPush/goOnlineChecks';
import { cancelOfferAlert } from '@app/services/offerPush/offerAlert';
import { isHomeInFront } from '@app/navigation/navigationRef';
import { color } from '@app/styles/theme';
import {
  CUSTOMER_SMS_PRESETS,
  smsUrl,
  telUrl,
} from '@app/utilities/jobContact';
import { useJobContact } from '@app/hooks/useJobContact';
import { useMoveDropoffPin } from '@app/hooks/useMoveDropoffPin';
import { useHandBack } from '@app/hooks/useHandBack';
import { useDeliveryRoute } from '@app/hooks/useDeliveryRoute';
import { usePickupPoints } from '@app/hooks/usePickupPoints';
import { useNavigateTo } from '@app/hooks/useNavigateTo';
import { useLocationPermission } from '@app/hooks/useLocationPermission';
import { SosHoldButton } from '@app/components/SosHoldButton/SosHoldButton';
import { SosActiveBanner } from '@app/components/SosActiveBanner/SosActiveBanner';
import { beginSos, openSosScreen, useSosRecord } from '@app/hooks/useSos';
import { isSharing } from '@app/services/sosStore';
import { setOwnPosition, useOwnPosition } from '@app/services/ownPosition';
import {
  getRestaurantLayerChoice,
  setRestaurantLayerChoice,
} from '@app/services/mapPreferences';
import {
  isBeforePickup,
  legLines,
  restaurantLayerOn,
  visibleLegs,
} from '@app/utilities/routeLegs';

type Props = DrawerScreenProp<DrawerScreens.Home>;

type CardItem = { kind: 'offer' | 'job'; order: Order };

// An offer's route is asked for at the server's offer status. A string, because
// the app's OrderStatus has no member for it: offers never carry their status.
const OFFER_STATUS = 'ASSIGNING_COURIER';

const pointOf = (location?: {
  latitude: number;
  longitude: number;
}): RoutePoint | undefined =>
  location
    ? { latitude: location.latitude, longitude: location.longitude }
    : undefined;

// Spec 0018: home is a full screen map with one card at the bottom holding
// what the rider deals with now, and the banners on top.
export const HomeScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const { user, isLoading, updateStatus } = useUser();
  const { movePin, movingId } = useMoveDropoffPin();
  // Spec 0020 (AC-9): the free hand back in the first minute after accepting.
  const { handBack, handingBackId } = useHandBack(user?.id);
  const connectionStatus = useConnectionStatus();
  const navigateTo = useNavigateTo();
  const { locationPermission } = useLocationPermission();
  const isFocused = useIsFocused();
  const { data: jobContact } = useJobContact(isFocused);
  const dispatchPhoneNumber = jobContact?.dispatchPhoneNumber;
  const userStatus = user?.status ?? UserStatus.Offline;
  // `?.` because Home can render for a moment with no user (logging out).
  const autoAcceptOrders = user?.deliverySetting === OrderSetting.auto_accept;

  const {
    dataSourceNew,
    dataSourceInProgress,
    serverInProgress,
    timeLeftForOffer,
    totalTimeForOffer,
    waitedTimeForOffer,
    refetchInProgress,
    declineOrderFn,
    acceptOrderFn,
  } = useHomeOrders();

  // Spec 0022 (AC-1): the SOS pill shows while the rider is Online, on Last
  // call, or holds a job, never Offline with no job. While their SOS is
  // active it gives way to the "SOS active" banner.
  const sosRecord = useSosRecord(user?.id);
  const sosActive = isSharing(sosRecord);
  const holdsJob = dataSourceInProgress.length > 0;
  const showSosPill =
    !!user && !sosActive && (userStatus !== UserStatus.Offline || holdsJob);
  const onSosHeld = () => {
    if (!user) {
      return;
    }
    // The job held now, if any: the first of the in progress list.
    beginSos(user.id, dataSourceInProgress[0]?.id).catch(error =>
      console.log('Could not start the SOS', error),
    );
  };

  useFocusEffect(
    useCallback(() => {
      refetchInProgress();
    }, [refetchInProgress]),
  );

  // While home is in front, an offer it shows needs no system alert as well
  // (spec 0003, AC-12).
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

  // AC-5: one read of the phone's own position when home comes into view, so
  // the map starts where the rider is even while Offline (no watch runs then).
  // It stays on the phone.
  useFocusEffect(
    useCallback(() => {
      // While Online, on Last call or holding a job, the tracking watch already
      // feeds the position; one more reader would only spend battery.
      const tracking =
        userStatus !== UserStatus.Offline || dataSourceInProgress.length > 0;
      if (!locationPermission || tracking) {
        return;
      }
      Geolocation.getCurrentPosition(
        position =>
          setOwnPosition({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        () => undefined,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    }, [locationPermission, userStatus, dataSourceInProgress.length]),
  );
  const storedOwnPosition = useOwnPosition();
  // Without the permission the phone has no position of its own to show.
  const ownPosition = locationPermission ? storedOwnPosition : null;

  // AC-8: offers first, then jobs. Riders on auto accept never see an offer
  // card: their offers are claimed on arrival and come back as jobs.
  const items = useMemo<CardItem[]>(
    () => [
      ...(autoAcceptOrders ? [] : dataSourceNew).map(order => ({
        kind: 'offer' as const,
        order,
      })),
      ...dataSourceInProgress.map(order => ({ kind: 'job' as const, order })),
    ],
    [autoAcceptOrders, dataSourceNew, dataSourceInProgress],
  );
  // Back to the first whenever the list changes (an offer ending, a 409 on
  // accept, a job finishing), so the position never points past the end.
  const listKey = items
    .map(item => `${item.kind}:${item.order.id}:${item.order.offeredAt ?? ''}`)
    .join('|');
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [listKey]);
  const shown: CardItem | undefined = items[Math.min(index, items.length - 1)];

  // AC-6: the route, asked for the server's status of the shown delivery.
  const serverJob =
    shown?.kind === 'job'
      ? serverInProgress.find(order => order.id === shown.order.id)
      : undefined;
  const serverStatus =
    shown?.kind === 'offer' ? OFFER_STATUS : serverJob?.status;
  const route = useDeliveryRoute({
    deliveryId: shown?.order.id,
    serverStatus,
    isJob: shown?.kind === 'job',
    waitingToSend: !!shown?.order.waitingToSend,
    inFront: isFocused,
  });
  const legs = visibleLegs(route.data ?? [], ownPosition);
  const lines = legLines(legs);
  const routeUnavailable = route.isError && route.data === undefined;

  // AC-11: the restaurant layer.
  const [layerChoice, setLayerChoice] = useState<'on' | 'off' | null>(null);
  useEffect(() => {
    getRestaurantLayerChoice().then(setLayerChoice);
  }, []);
  const layerOn = restaurantLayerOn(layerChoice, user?.createdAt);
  const pickupPoints = usePickupPoints(true).data ?? [];
  const toggleLayer = () => {
    const next = !layerOn;
    setLayerChoice(next ? 'on' : 'off');
    setRestaurantLayerChoice(next).catch(() => undefined);
  };

  const [cardHeight, setCardHeight] = useState(0);

  const confirmStatus = (newStatus: UserStatus) =>
    navigation.navigate(RootScreen.UserStatusModal, {
      status: newStatus,
      onAccept: () => updateStatus(newStatus),
      onCancel: () => undefined,
    });

  const onGoOnline = async (didSwipe: boolean) => {
    if (!didSwipe) {
      return;
    }
    // The first time, ask for the alert permissions; every time, warn if the
    // phone is on silent (spec 0003, AC-8, AC-9). Either answer goes Online.
    await prepareToGoOnline();
    updateStatus(UserStatus.Online);
  };

  // Row 72: calls and texts open the phone's own apps; nothing is recorded.
  const openContactUrl = (url: string) => {
    Linking.openURL(url).catch(error =>
      console.log('Could not open the phone or messages app', error),
    );
  };

  const showCustomerMessages = (order: Order) => {
    const phoneNumber = order.dropoffPhoneNumber;
    if (!phoneNumber) {
      return;
    }
    const options = [
      ...CUSTOMER_SMS_PRESETS.map(preset => t(`translations:${preset.key}`)),
      t('translations:cancel'),
    ];
    ActionSheet.showActionSheetWithOptions(
      {
        title: t('translations:text_customer_title'),
        options,
        cancelButtonIndex: CUSTOMER_SMS_PRESETS.length,
        tintColor: color.route,
        cancelButtonTintColor: color.destructive,
      },
      (buttonIndex: number) => {
        const preset = CUSTOMER_SMS_PRESETS[buttonIndex];
        if (preset !== undefined) {
          openContactUrl(smsUrl(phoneNumber, preset.body));
        }
      },
    );
  };

  // AC-12: Navigate goes to the restaurant before pickup, to the customer after.
  const onNavigate = (order: Order) => {
    const point = isBeforePickup(order.status)
      ? order.pickupLocation
      : order.dropoffLocation;
    if (point) {
      navigateTo(pointOf(point)!);
    }
  };
  const renderShown = () => {
    if (!shown) {
      return null;
    }
    const order = shown.order;
    if (shown.kind === 'offer') {
      return (
        <NewOrderCell
          key={`${order.id}-${order.offeredAt ?? ''}`}
          millisRemaining={timeLeftForOffer(order.id)}
          totalMillis={totalTimeForOffer(order.id)}
          millisWaited={waitedTimeForOffer(order.id)}
          autoAcceptOrders={autoAcceptOrders}
          order={order}
          onAccept={offer => acceptOrderFn(offer.id)}
          onDecline={offer => declineOrderFn(offer.id)}
        />
      );
    }
    return (
      <InProgressCell
        key={order.id}
        order={order}
        onCallCustomer={job =>
          openContactUrl(telUrl(job.dropoffPhoneNumber ?? ''))
        }
        onCallRestaurant={job => openContactUrl(telUrl(job.pickupPhoneNumber))}
        onTextCustomer={showCustomerMessages}
        onMovePin={movePin}
        movingPin={movingId === order.id}
        toRestaurant={lines.toRestaurant}
        toCustomer={lines.toCustomer}
        routeUnavailable={routeUnavailable}
        onNavigate={onNavigate}
      />
    );
  };

  // Spec 0021 (AC-9): the job's swipe and small actions, pinned below the card.
  const renderFooter = () => {
    if (shown?.kind !== 'job') {
      return null;
    }
    const order = shown.order;
    return (
      <JobFooter
        key={order.id}
        order={order}
        onReportIssue={job =>
          navigation.navigate(MainScreens.ReportIssue, { order: job })
        }
        onReportProduct={job =>
          navigation.navigate(MainScreens.ReportProduct, { order: job })
        }
        onCallDispatch={
          dispatchPhoneNumber
            ? () => openContactUrl(telUrl(dispatchPhoneNumber))
            : undefined
        }
        onHandBack={handBack}
        handingBack={handingBackId === order.id}
      />
    );
  };

  const cardMode = (): HomeCardMode => {
    if (shown?.kind === 'offer') {
      return HomeCardMode.Offer;
    }
    if (shown?.kind === 'job') {
      return HomeCardMode.Job;
    }
    switch (userStatus) {
      case UserStatus.Online:
        return HomeCardMode.Online;
      case UserStatus.LastCall:
        return HomeCardMode.LastCall;
      default:
        return HomeCardMode.Offline;
    }
  };

  const shownPickup =
    shown?.order.status === OrderStatus.dropped_off
      ? undefined
      : pointOf(shown?.order.pickupLocation);
  const shownDropoff =
    shown?.order.status === OrderStatus.dropped_off
      ? undefined
      : pointOf(shown?.order.dropoffLocation);

  return (
    <View style={styles.container} testID="home-screen">
      <RouteMap
        legs={legs}
        pickup={shownPickup}
        dropoff={shownDropoff}
        ownPosition={ownPosition}
        restaurantLayerOn={layerOn}
        pickupPoints={pickupPoints}
        onToggleRestaurantLayer={toggleLayer}
        fitKey={`${shown?.order.id ?? 'none'}-${serverStatus ?? ''}`}
        bottomInset={cardHeight}
      />
      <HomeTopSlot
        userStatus={userStatus}
        connectionStatus={connectionStatus}
        onMenu={() => navigation.toggleDrawer()}
        sosAction={
          showSosPill ? <SosHoldButton onHeld={onSosHeld} /> : undefined
        }>
        {/* The rider's own SOS is active (spec 0022, AC-3). */}
        {sosActive && <SosActiveBanner onPress={() => openSosScreen()} />}
        {/* On shift or free, while the co-op runs shifts (spec 0027). */}
        <ShiftBanner inFront={isFocused} />
        {/* Dispatch stopped for heat or a storm, or about to be (spec 0014). */}
        <DispatchStopBanner inFront={isFocused} />
        {/* Spec 0015: a job this rider held was cancelled. */}
        <CancelledJobCard inFront={isFocused} />
        {/* Steps the co-op refused after they waited for signal (spec 0009). */}
        <RefusedSteps courierId={user?.id} />
      </HomeTopSlot>
      <HomeCard
        mode={cardMode()}
        pager={{
          index: Math.min(index, Math.max(items.length - 1, 0)),
          count: items.length,
          onPrevious: () =>
            setIndex(current => (current - 1 + items.length) % items.length),
          onNext: () => setIndex(current => (current + 1) % items.length),
        }}
        isLoading={isLoading ?? false}
        onGoOnline={onGoOnline}
        onLastCall={() => confirmStatus(UserStatus.LastCall)}
        onStayOnline={() => updateStatus(UserStatus.Online)}
        onGoOffline={() => confirmStatus(UserStatus.Offline)}
        onHeight={setCardHeight}
        footer={renderFooter()}>
        {renderShown()}
      </HomeCard>
    </View>
  );
};
