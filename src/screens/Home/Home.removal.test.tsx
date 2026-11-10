import React from 'react';
import { render, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@app/localization/i18n';
import { HomeScreen } from './Home';
import { Order, User, UserStatus } from '@app/types/types';
import { OrderSetting, OrderStatus } from '@app/types/enums';
import { JobFooter } from '@app/components/JobFooter/JobFooter';
import { RemovalNotices } from '@app/components/RemovalNotices/RemovalNotices';
import { DrawerScreens } from '@app/navigation/drawer/types';
import { MainScreens } from '@app/navigation/main/types';
import {
  useRemovalBusy,
  useWithdrawRemoval,
} from '@app/hooks/useRemovalRequest';

jest.mock('@app/hooks/useRemovalRequest');

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const mockReact = require('react');
  return {
    ...actual,
    useIsFocused: () => true,
    useFocusEffect: (callback: () => void | (() => void)) => {
      mockReact.useEffect(() => {
        return callback();
      }, [callback]);
    },
  };
});

jest.mock('@app/hooks/useDispatchState', () => ({
  useDispatchState: () => ({
    data: { current: null, next: null },
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@app/hooks/useJobContact', () => ({
  useJobContact: () => ({
    data: { dispatchPhoneNumber: '+302421012345' },
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

const mockUser: User = {
  id: 'courier-1',
  status: UserStatus.Online,
  deliverySetting: OrderSetting.manual,
  createdAt: new Date().toISOString(),
} as User;

jest.mock('@app/hooks/useUser', () => () => ({
  user: mockUser,
  isLoading: false,
  updateStatus: jest.fn(),
}));

jest.mock('@app/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    locationPermission: true,
  }),
}));

jest.mock('@app/hooks/useDeliveryRoute', () => ({
  useDeliveryRoute: () => ({
    data: null,
    isLoading: false,
    isError: false,
  }),
}));

jest.mock('@app/hooks/usePickupPoints', () => ({
  usePickupPoints: () => ({
    data: [],
    isLoading: false,
  }),
}));

jest.mock('@app/hooks/useNavigateTo', () => ({
  useNavigateTo: () => jest.fn(),
}));

jest.mock('@app/services/socket', () => ({
  useConnectionStatus: () => 'connected',
}));

const mockJob: Order = {
  id: 'delivery-job-removal-wiring',
  status: OrderStatus.dispatched,
  pickupBusinessName: 'Acropolis Grill',
  dropoffAddress: 'Ermou 15, Volos',
  arrivedAtPickupAt: null,
  arrivedAtDropoffAt: null,
  handBackUntilOnPhone: Date.now() - 60_000,
  removalRequest: null,
} as unknown as Order;

let mockHomeOrders = {
  dataSourceNew: [] as any[],
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

jest.mock('@app/hooks/useHomeOrders', () => ({
  useHomeOrders: () => mockHomeOrders,
}));

describe('HomeScreen removal wiring (spec 0035, AC-3, AC-5, AC-11, decision 24.25)', () => {
  const mockNav = {
    navigate: jest.fn(),
    toggleDrawer: jest.fn(),
  } as any;

  const mockRoute = {
    key: 'home-key',
    name: DrawerScreens.Home,
    params: undefined,
  } as any;

  let testQueryClient: QueryClient;
  const mockWithdrawFn = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useWithdrawRemoval as jest.Mock).mockReturnValue(mockWithdrawFn);
    (useRemovalBusy as jest.Mock).mockReturnValue(false);

    testQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
  });

  afterEach(() => {
    testQueryClient.clear();
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

  it("wires JobFooter's onRequestRemoval to navigate to MainScreens.RequestRemoval with { order }", async () => {
    const { UNSAFE_getByType } = renderHome();

    const footer = UNSAFE_getByType(JobFooter);
    expect(footer.props.onRequestRemoval).toBeDefined();

    await act(async () => {
      footer.props.onRequestRemoval!(mockJob);
    });

    expect(mockNav.navigate).toHaveBeenCalledWith(MainScreens.RequestRemoval, {
      order: mockJob,
    });
  });

  it("wires JobFooter's onWithdrawRemoval to the hook's function", () => {
    const { UNSAFE_getByType } = renderHome();

    const footer = UNSAFE_getByType(JobFooter);
    expect(footer.props.onWithdrawRemoval).toBe(mockWithdrawFn);
  });

  it('sets removalBusy to true on JobFooter when useRemovalBusy is true for the shown job, and false when false', () => {
    (useRemovalBusy as jest.Mock).mockImplementation(
      (deliveryId: string | undefined) =>
        deliveryId === 'delivery-job-removal-wiring',
    );

    const { UNSAFE_getByType, rerender } = renderHome();

    let footer = UNSAFE_getByType(JobFooter);
    expect(footer.props.removalBusy).toBe(true);
    expect(useRemovalBusy).toHaveBeenCalledWith('delivery-job-removal-wiring');

    // When useRemovalBusy returns false
    (useRemovalBusy as jest.Mock).mockReturnValue(false);
    rerender(
      <QueryClientProvider client={testQueryClient}>
        <NavigationContainer>
          <HomeScreen navigation={mockNav} route={mockRoute} />
        </NavigationContainer>
      </QueryClientProvider>,
    );

    footer = UNSAFE_getByType(JobFooter);
    expect(footer.props.removalBusy).toBe(false);
  });

  it('renders RemovalNotices component on Home in HomeTopSlot (AC-11)', () => {
    const { UNSAFE_getByType } = renderHome();

    expect(UNSAFE_getByType(RemovalNotices)).toBeTruthy();
  });
});
