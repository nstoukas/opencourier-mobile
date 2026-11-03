import React from 'react';
import { Alert, Linking } from 'react-native';
import {
  render,
  act,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActionSheet from 'react-native-action-sheet';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { HomeScreen } from './Home';
import { Order, User, UserStatus } from '@app/types/types';
import { OrderSetting, OrderStatus } from '@app/types/enums';
import { InProgressCell } from '@app/components/InProgressCell/InProgressCell';
import { NewOrderCell } from '@app/components/NewOrderCell/NewOrderCell';
import { RouteMap } from '@app/components/RouteMap/RouteMap';
import { HomeTopSlot } from '@app/components/HomeTopSlot/HomeTopSlot';
import { HomeCard } from '@app/components/HomeCard/HomeCard';
import { JobFooter } from '@app/components/JobFooter/JobFooter';
import ButtonSwipe from '@app/components/ButtonSwipe/ButtonSwipe';
import { DispatchStopBanner } from '@app/components/DispatchStopBanner/DispatchStopBanner';
import { CancelledJobCard } from '@app/components/CancelledJobCard/CancelledJobCard';
import { RefusedSteps } from '@app/components/RefusedSteps/RefusedSteps';
import { useDispatchState } from '@app/hooks/useDispatchState';
import { useJobContact } from '@app/hooks/useJobContact';
import { CUSTOMER_SMS_PRESETS, smsUrl } from '@app/utilities/jobContact';
import { DrawerScreens } from '@app/navigation/drawer/types';
import { RouteLeg, RouteLegKind } from '@app/types/route';
import { services } from '@app/services/service';
import * as mapPreferences from '@app/services/mapPreferences';
import * as ownPositionModule from '@app/services/ownPosition';
import * as useSosModule from '@app/hooks/useSos';
import { resetSosStoreForTests, startSos } from '@app/services/sosStore';
import Geolocation from 'react-native-geolocation-service';
import * as shiftsApi from '@app/services/shifts/shiftsApi';

let mockIsFocused = true;
let mockLocationPermission = true;

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const mockReact = require('react');
  return {
    ...actual,
    useIsFocused: () => mockIsFocused,
    useFocusEffect: (callback: () => void | (() => void)) => {
      mockReact.useEffect(() => {
        return callback();
      }, [callback]);
    },
  };
});

let mockDispatchState: any = {
  current: null,
  next: null,
};

jest.mock('@app/hooks/useDispatchState', () => ({
  useDispatchState: jest.fn((inFront: boolean = true) => ({
    data: mockDispatchState,
    isLoading: false,
    refetch: jest.fn(),
  })),
}));

let mockJobContact: any = {
  dispatchPhoneNumber: '+302421012345',
};

jest.mock('@app/hooks/useJobContact', () => ({
  useJobContact: jest.fn(() => ({
    data: mockJobContact,
    isLoading: false,
    refetch: jest.fn(),
  })),
}));

let mockUser: User | undefined = {
  id: 'courier-1',
  status: UserStatus.Online,
  deliverySetting: OrderSetting.manual,
  createdAt: new Date().toISOString(),
} as User;

const mockUpdateStatus = jest.fn();

jest.mock('@app/hooks/useUser', () => () => ({
  user: mockUser,
  isLoading: false,
  updateStatus: mockUpdateStatus,
}));

jest.mock('@app/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    locationPermission: mockLocationPermission,
    requestLocationPermission: jest.fn(),
  }),
}));

const mockOffer: Order = {
  id: 'offer-999',
  offeredAt: '2026-11-02T10:00:00.000Z',
  totalCompensation: 500,
  pickupLocation: { latitude: 39.36, longitude: 22.94 },
  dropoffLocation: { latitude: 39.37, longitude: 22.95 },
  pickupLocationFormattedAddress: 'Offer Restaurant',
  dropoffLocationFormattedAddress: 'Offer Customer',
} as unknown as Order;

const mockJob: Order = {
  id: 'job-123',
  status: OrderStatus.dispatched,
  pickupLocation: { latitude: 39.36, longitude: 22.94 },
  dropoffLocation: { latitude: 39.37, longitude: 22.95 },
  pickupPhoneNumber: '111222333',
  dropoffPhoneNumber: '444555666',
  orderItems: [],
} as unknown as Order;

let mockHomeOrders = {
  dataSourceNew: [] as Order[],
  dataSourceInProgress: [mockJob] as Order[],
  serverInProgress: [mockJob] as Order[],
  timeLeftForOffer: jest.fn().mockReturnValue(30000),
  totalTimeForOffer: jest.fn().mockReturnValue(60000),
  waitedTimeForOffer: jest.fn().mockReturnValue(0),
  refetchNew: jest.fn(),
  refetchInProgress: jest.fn(),
  declineOrderFn: jest.fn(),
  acceptOrderFn: jest.fn(),
  isLoading: false,
};

jest.mock('@app/hooks/useHomeOrders', () => ({
  useHomeOrders: () => mockHomeOrders,
}));

const mockRouteLegs: RouteLeg[] = [
  {
    kind: RouteLegKind.RiderToPickup,
    distanceMetres: 1200,
    durationSeconds: 240,
    points: [
      { latitude: 39.3622, longitude: 22.9425 },
      { latitude: 39.365, longitude: 22.945 },
    ],
  },
  {
    kind: RouteLegKind.PickupToDropoff,
    distanceMetres: 2900,
    durationSeconds: 300,
    points: [
      { latitude: 39.365, longitude: 22.945 },
      { latitude: 39.37, longitude: 22.95 },
    ],
  },
];

describe('HomeScreen (spec 0018, AC-5 to AC-15)', () => {
  const mockNav = {
    navigate: jest.fn(),
    toggleDrawer: jest.fn(),
  } as any;
  const mockRoute = {
    key: 'home-key',
    name: DrawerScreens.Home,
    params: undefined,
  } as any;

  let openURLSpy: jest.SpyInstance;
  let canOpenURLSpy: jest.SpyInstance;
  let testQueryClient: QueryClient;
  let getDeliveryRouteSpy: jest.SpyInstance;
  let getPickupPointsSpy: jest.SpyInstance;

  beforeEach(() => {
    resetSosStoreForTests();
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockIsFocused = true;
    mockLocationPermission = true;
    mockDispatchState = { current: null, next: null };
    mockJobContact = { dispatchPhoneNumber: '+302421012345' };
    testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    mockUser = {
      id: 'courier-1',
      status: UserStatus.Online,
      deliverySetting: OrderSetting.manual,
      createdAt: new Date().toISOString(),
    } as User;
    mockHomeOrders = {
      dataSourceNew: [],
      dataSourceInProgress: [mockJob],
      serverInProgress: [mockJob],
      timeLeftForOffer: jest.fn().mockReturnValue(30000),
      totalTimeForOffer: jest.fn().mockReturnValue(60000),
      waitedTimeForOffer: jest.fn().mockReturnValue(0),
      refetchNew: jest.fn(),
      refetchInProgress: jest.fn(),
      declineOrderFn: jest.fn(),
      acceptOrderFn: jest.fn(),
      isLoading: false,
    };
    openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    canOpenURLSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    getDeliveryRouteSpy = jest
      .spyOn(services.routeService, 'getDeliveryRoute')
      .mockResolvedValue(mockRouteLegs);
    getPickupPointsSpy = jest
      .spyOn(services.routeService, 'getPickupPoints')
      .mockResolvedValue([]);
    jest
      .spyOn(mapPreferences, 'getRestaurantLayerChoice')
      .mockResolvedValue(null);
    ownPositionModule.setOwnPosition({ latitude: 39.3622, longitude: 22.9425 });
  });

  afterEach(() => {
    cleanup();
    openURLSpy.mockRestore();
    canOpenURLSpy.mockRestore();
    getDeliveryRouteSpy.mockRestore();
    getPickupPointsSpy.mockRestore();
    testQueryClient.clear();
    ownPositionModule.setOwnPosition(null);
    jest.useRealTimers();
  });

  const renderHome = () =>
    render(
      <QueryClientProvider client={testQueryClient}>
        <NavigationContainer>
          <HomeScreen navigation={mockNav} route={mockRoute} />
        </NavigationContainer>
      </QueryClientProvider>,
    );

  describe('Card states with no offers or jobs (Pin 6)', () => {
    it('with status ONLINE shows "Waiting for offers", Last call button, and Go offline button', () => {
      mockHomeOrders.dataSourceNew = [];
      mockHomeOrders.dataSourceInProgress = [];
      mockHomeOrders.serverInProgress = [];
      mockUser!.status = UserStatus.Online;

      const { getByTestId, getByText } = renderHome();

      expect(getByTestId('home-card-waiting')).toBeTruthy();
      expect(getByText(i18n.t('translations:waiting_for_offers'))).toBeTruthy();
      expect(getByText(i18n.t('translations:last_call_button'))).toBeTruthy();
      expect(getByText(i18n.t('translations:go_offline'))).toBeTruthy();
    });

    it('with status LAST_CALL shows "Last call: you go offline when you accept your next order.", Stay online button, and Go offline button', () => {
      mockHomeOrders.dataSourceNew = [];
      mockHomeOrders.dataSourceInProgress = [];
      mockHomeOrders.serverInProgress = [];
      mockUser!.status = UserStatus.LastCall;

      const { getByTestId, getByText } = renderHome();

      expect(getByTestId('home-card-last-call')).toBeTruthy();
      expect(
        getByText(i18n.t('translations:last_call_explained')),
      ).toBeTruthy();
      expect(getByText(i18n.t('translations:stay_online'))).toBeTruthy();
      expect(getByText(i18n.t('translations:go_offline'))).toBeTruthy();
    });

    it('with status OFFLINE shows the Go online swipe', () => {
      mockHomeOrders.dataSourceNew = [];
      mockHomeOrders.dataSourceInProgress = [];
      mockHomeOrders.serverInProgress = [];
      mockUser!.status = UserStatus.Offline;

      const { getByText, UNSAFE_getByType } = renderHome();

      expect(getByText(i18n.t('translations:go_online'))).toBeTruthy();
      const swipe = UNSAFE_getByType(ButtonSwipe);
      expect(swipe.props.title).toBe(i18n.t('translations:go_online'));
    });
  });

  describe('Offers and jobs in the card (Pin 6, AC-8)', () => {
    it('shows NewOrderCell with Accept swipe and Decline button when an offer is present, before any job', () => {
      mockHomeOrders.dataSourceNew = [mockOffer];
      mockHomeOrders.dataSourceInProgress = [mockJob];
      mockHomeOrders.serverInProgress = [mockJob];

      const { UNSAFE_getByType, UNSAFE_queryByType } = renderHome();

      // Offer cell is shown
      expect(UNSAFE_getByType(NewOrderCell)).toBeTruthy();
      // Job cell is NOT shown since offer comes first
      expect(UNSAFE_queryByType(InProgressCell)).toBeNull();
    });

    it('renders NewOrderCell without onCopyCustomer, onCopyRestaurant, toRestaurant, toCustomer or routeUnavailable (Pin 6, spec 0019, AC-3)', () => {
      mockHomeOrders.dataSourceNew = [mockOffer];
      mockHomeOrders.dataSourceInProgress = [];
      mockHomeOrders.serverInProgress = [];

      const { UNSAFE_getByType } = renderHome();

      const cell = UNSAFE_getByType(NewOrderCell);
      expect(cell).toBeTruthy();
      expect('onCopyCustomer' in cell.props).toBe(false);
      expect('onCopyRestaurant' in cell.props).toBe(false);
      expect('toRestaurant' in cell.props).toBe(false);
      expect('toCustomer' in cell.props).toBe(false);
      expect('routeUnavailable' in cell.props).toBe(false);
    });

    it('a rider on auto accept sees no offer card', () => {
      mockUser!.deliverySetting = OrderSetting.auto_accept;
      mockHomeOrders.dataSourceNew = [mockOffer];
      mockHomeOrders.dataSourceInProgress = [mockJob];
      mockHomeOrders.serverInProgress = [mockJob];

      const { UNSAFE_queryByType, UNSAFE_getByType } = renderHome();

      // Offer cell is hidden
      expect(UNSAFE_queryByType(NewOrderCell)).toBeNull();
      // Job cell is shown instead
      expect(UNSAFE_getByType(InProgressCell)).toBeTruthy();
    });

    it('with two items shows "1 of 2", next/previous moves between them, and resets to first on list change', async () => {
      const job2: Order = { ...mockJob, id: 'job-456' };
      mockHomeOrders.dataSourceNew = [];
      mockHomeOrders.dataSourceInProgress = [mockJob, job2];
      mockHomeOrders.serverInProgress = [mockJob, job2];

      const { getByTestId, getByText, queryByText, rerender } = renderHome();

      // Pager shows "1 of 2"
      expect(getByTestId('home-card-pager')).toBeTruthy();
      expect(
        getByText(
          i18n.t('translations:card_position', { position: 1, count: 2 }),
        ),
      ).toBeTruthy();

      // Tap next
      fireEvent.press(getByTestId('home-card-next'));
      expect(
        getByText(
          i18n.t('translations:card_position', { position: 2, count: 2 }),
        ),
      ).toBeTruthy();

      // Tap previous
      fireEvent.press(getByTestId('home-card-previous'));
      expect(
        getByText(
          i18n.t('translations:card_position', { position: 1, count: 2 }),
        ),
      ).toBeTruthy();

      // Move to second position, then update the list
      fireEvent.press(getByTestId('home-card-next'));
      expect(
        getByText(
          i18n.t('translations:card_position', { position: 2, count: 2 }),
        ),
      ).toBeTruthy();

      // List changes (e.g. job finishes, replaced by single job)
      mockHomeOrders.dataSourceInProgress = [job2];
      mockHomeOrders.serverInProgress = [job2];

      rerender(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      // Now single job: pager is gone
      expect(queryByText(/of 2/)).toBeNull();
    });

    it('home has no tabs and no History', () => {
      const { queryByText } = renderHome();

      expect(queryByText(/history/i)).toBeNull();
      expect(queryByText(/in progress/i)).toBeNull();
      expect(queryByText(/new orders/i)).toBeNull();
    });
  });

  describe('Top slot, routes, and RouteLines (Pin 6, AC-6, AC-14)', () => {
    it('top slot shows the ProfileBadge, ConnectionDot, and banners', () => {
      mockDispatchState = {
        current: {
          reason: 'STORM',
          message: 'Dispatch stopped for storm',
        },
        next: null,
      };

      const { getByTestId, getByText } = renderHome();

      expect(getByTestId('home-top-slot')).toBeTruthy();
      expect(getByTestId('connection-dot')).toBeTruthy();
      expect(getByTestId('dispatch-stop-banner')).toBeTruthy();
      expect(getByText('Dispatch stopped for storm')).toBeTruthy();
    });

    it('requests the route with server status of shown job and feeds legs to RouteMap and InProgressCell', async () => {
      mockHomeOrders.dataSourceNew = [];
      mockHomeOrders.dataSourceInProgress = [mockJob];
      mockHomeOrders.serverInProgress = [
        { ...mockJob, status: OrderStatus.dispatched },
      ];

      const component = renderHome();

      // Route requested for delivery id
      expect(getDeliveryRouteSpy).toHaveBeenCalledWith(mockJob.id);

      await waitFor(() => {
        const routeMap = component.UNSAFE_getByType(RouteMap);
        expect(routeMap.props.legs.length).toBeGreaterThan(0);
      });

      // InProgressCell receives formatted km and minutes
      const cell = component.UNSAFE_getByType(InProgressCell);
      expect(cell.props.toRestaurant).toEqual({ km: '1.2', minutes: 4 });
      expect(cell.props.toCustomer).toEqual({ km: '2.9', minutes: 5 });

      // JobFooter is rendered in HomeCard footer slot outside ScrollView (spec 0021, AC-9)
      const homeCard = component.UNSAFE_getByType(HomeCard);
      expect(homeCard.props.footer).toBeTruthy();
      const jobFooter = component.UNSAFE_getByType(JobFooter);
      expect(jobFooter.props.order.id).toBe(mockJob.id);
    });

    it('shows "Route not available" when route query fails with no data', async () => {
      getDeliveryRouteSpy.mockRejectedValue(
        new Error('503 Service Unavailable'),
      );
      mockHomeOrders.dataSourceNew = [];
      mockHomeOrders.dataSourceInProgress = [mockJob];
      mockHomeOrders.serverInProgress = [mockJob];

      const { getByTestId } = renderHome();

      for (let i = 0; i < 5; i++) {
        await act(async () => {
          jest.advanceTimersByTime(1000);
        });
      }

      expect(getByTestId('route-unavailable')).toBeTruthy();
      expect(getByTestId('route-unavailable').props.children).toBe(
        i18n.t('translations:route_not_available'),
      );
    });
  });

  describe('Contact controls from the job card (preserved from row 72)', () => {
    it('wires onCallCustomer and onCallRestaurant to phone urls', async () => {
      const { UNSAFE_getByType } = renderHome();

      const cell = UNSAFE_getByType(InProgressCell);
      await act(async () => {
        cell.props.onCallCustomer(mockJob);
      });
      expect(openURLSpy).toHaveBeenCalledWith('tel:444555666');

      await act(async () => {
        cell.props.onCallRestaurant(mockJob);
      });
      expect(openURLSpy).toHaveBeenCalledWith('tel:111222333');
    });

    it('wires onCallDispatch when dispatchPhoneNumber is set', async () => {
      const { UNSAFE_getByType } = renderHome();

      const footer = UNSAFE_getByType(JobFooter);
      expect(footer.props.onCallDispatch).toBeDefined();

      await act(async () => {
        footer.props.onCallDispatch!();
      });
      expect(openURLSpy).toHaveBeenCalledWith('tel:+302421012345');
    });

    it('shows preset messages via ActionSheet for onTextCustomer', async () => {
      const { UNSAFE_getByType } = renderHome();

      const cell = UNSAFE_getByType(InProgressCell);
      await act(async () => {
        cell.props.onTextCustomer!(mockJob);
      });

      expect(ActionSheet.showActionSheetWithOptions).toHaveBeenCalled();
      const [config, onSelect] = (
        ActionSheet.showActionSheetWithOptions as jest.Mock
      ).mock.calls[0];

      expect(config.title).toBe(i18n.t('translations:text_customer_title'));

      // Select preset 0
      await act(async () => {
        onSelect(0);
      });

      expect(openURLSpy).toHaveBeenCalledWith(
        smsUrl(mockJob.dropoffPhoneNumber!, CUSTOMER_SMS_PRESETS[0].body),
      );
    });
  });

  describe('User deliverySetting safety', () => {
    it('renders safely when user is undefined (no crash on deliverySetting)', () => {
      mockUser = undefined;
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => {
        renderHome();
      }).not.toThrow();

      errorSpy.mockRestore();
    });
  });

  describe('one shot getCurrentPosition on focus (spec 0018 AC-5, review nit)', () => {
    it('runs on focus only when rider is Offline with no job and has permission', () => {
      mockUser!.status = UserStatus.Offline;
      mockHomeOrders.dataSourceInProgress = [];
      mockLocationPermission = true;

      renderHome();

      expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    });

    it('does NOT run when rider is Online', () => {
      mockUser!.status = UserStatus.Online;
      mockHomeOrders.dataSourceInProgress = [];
      mockLocationPermission = true;

      renderHome();

      expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('does NOT run when rider is on Last call', () => {
      mockUser!.status = UserStatus.LastCall;
      mockHomeOrders.dataSourceInProgress = [];
      mockLocationPermission = true;

      renderHome();

      expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('does NOT run when rider is holding a job', () => {
      mockUser!.status = UserStatus.Offline;
      mockHomeOrders.dataSourceInProgress = [mockJob];
      mockLocationPermission = true;

      renderHome();

      expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('does NOT run when locationPermission is false', () => {
      mockUser!.status = UserStatus.Offline;
      mockHomeOrders.dataSourceInProgress = [];
      mockLocationPermission = false;

      renderHome();

      expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
    });
  });

  describe('SOS pill and banner visibility (spec 0022, AC-1)', () => {
    it('shows SOS pill when ONLINE with no jobs', () => {
      mockUser!.status = UserStatus.Online;
      mockHomeOrders.dataSourceInProgress = [];

      const { getByTestId, queryByTestId } = renderHome();

      expect(getByTestId('sos-hold-button')).toBeTruthy();
      expect(queryByTestId('sos-active-banner')).toBeNull();
    });

    it('shows SOS pill when LAST_CALL with no jobs', () => {
      mockUser!.status = UserStatus.LastCall;
      mockHomeOrders.dataSourceInProgress = [];

      const { getByTestId, queryByTestId } = renderHome();

      expect(getByTestId('sos-hold-button')).toBeTruthy();
      expect(queryByTestId('sos-active-banner')).toBeNull();
    });

    it('shows SOS pill when OFFLINE while holding a job', () => {
      mockUser!.status = UserStatus.Offline;
      mockHomeOrders.dataSourceInProgress = [mockJob];

      const { getByTestId, queryByTestId } = renderHome();

      expect(getByTestId('sos-hold-button')).toBeTruthy();
      expect(queryByTestId('sos-active-banner')).toBeNull();
    });

    it('never shows SOS pill when OFFLINE with no job', () => {
      mockUser!.status = UserStatus.Offline;
      mockHomeOrders.dataSourceInProgress = [];

      const { queryByTestId } = renderHome();

      expect(queryByTestId('sos-hold-button')).toBeNull();
      expect(queryByTestId('sos-active-banner')).toBeNull();
    });

    it('hides SOS pill and shows SOS active banner while rider SOS is shared, tapping banner opens Sos screen', async () => {
      mockUser!.status = UserStatus.Online;
      mockHomeOrders.dataSourceInProgress = [];

      // Start an SOS for this courier
      await act(async () => {
        await startSos('courier-1', { clientId: 'c1', heldAt: 1000 });
      });

      const openSosScreenSpy = jest
        .spyOn(useSosModule, 'openSosScreen')
        .mockImplementation(() => {});

      const { queryByTestId, getByTestId } = renderHome();

      expect(queryByTestId('sos-hold-button')).toBeNull();
      expect(getByTestId('sos-active-banner')).toBeTruthy();

      // Tapping banner opens Sos screen
      fireEvent.press(getByTestId('sos-active-banner'));
      expect(openSosScreenSpy).toHaveBeenCalledTimes(1);

      openSosScreenSpy.mockRestore();
    });
  });
  describe('Shift banner on Home (spec 0027, AC-1, AC-8)', () => {
    let fetchShiftsSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchShiftsSpy = jest.spyOn(shiftsApi, 'fetchShifts').mockResolvedValue({
        serverNow: new Date().toISOString(),
        occurrences: [],
        myBookings: [],
        clockOffsetMs: 0,
      });
    });

    afterEach(() => {
      fetchShiftsSpy.mockRestore();
    });

    it('shows "FREE (no shift)" while the co-op runs shifts', async () => {
      mockJobContact = {
        dispatchPhoneNumber: '+302421012345',
        shiftsEnabled: true,
      };
      const { findByTestId, getByText } = renderHome();
      expect(await findByTestId('shift-banner')).toBeTruthy();
      expect(getByText('FREE (no shift)')).toBeTruthy();
      expect(fetchShiftsSpy).toHaveBeenCalled();
    });

    it('shows no banner and reads no schedule while shifts are off or unknown', () => {
      for (const contact of [
        { dispatchPhoneNumber: '+302421012345', shiftsEnabled: false },
        { dispatchPhoneNumber: '+302421012345' },
      ]) {
        mockJobContact = contact;
        const { queryByTestId, unmount } = renderHome();
        expect(queryByTestId('shift-banner')).toBeNull();
        unmount();
      }
      expect(fetchShiftsSpy).not.toHaveBeenCalled();
    });
  });
});
