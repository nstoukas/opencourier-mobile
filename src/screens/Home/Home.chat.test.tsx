import React from 'react';
import { render, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@app/localization/i18n';
import { HomeScreen } from './Home';
import { Order, User, UserStatus } from '@app/types/types';
import { OrderSetting, OrderStatus } from '@app/types/enums';
import { JobFooter } from '@app/components/JobFooter/JobFooter';
import { DrawerScreens } from '@app/navigation/drawer/types';
import { MainScreens } from '@app/navigation/main/types';
import { useChatUnseen } from '@app/hooks/useChat';

jest.mock('@app/hooks/useChat');

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
  updateDeliverySettings: jest.fn(),
}));

jest.mock('@app/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    locationPermission: true,
    requestLocationPermission: jest.fn(),
  }),
}));


const mockJob: Order = {
  id: 'del-job-chat-1',
  orderReference: 'ORD-9876',
  status: OrderStatus.dispatched,
  pickupBusinessName: 'Test Kitchen',
  dropoffAddress: 'Iasonos 45, Volos',
  pickupLocation: { latitude: 39.36, longitude: 22.94 },
  dropoffLocation: { latitude: 39.37, longitude: 22.95 },
  items: [],
  waitingToSend: false,
} as unknown as Order;

const mockHomeOrders = {
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

describe('HomeScreen chat wiring (spec 0034, AC-12)', () => {
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
  let currentRender: ReturnType<typeof render> | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useChatUnseen as jest.Mock).mockReturnValue(true);

    testQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    currentRender?.unmount();
    currentRender = null;
    testQueryClient.clear();
    jest.clearAllMocks();
  });

  const renderHome = () => {
    currentRender = render(
      <QueryClientProvider client={testQueryClient}>
        <NavigationContainer>
          <HomeScreen navigation={mockNav} route={mockRoute} />
        </NavigationContainer>
      </QueryClientProvider>,
    );
    return currentRender;
  };

  it('wires onOpenChat on JobFooter to navigate to MainScreens.Chat with { deliveryId, orderReference } of that job', async () => {
    const { UNSAFE_getByType } = renderHome();

    const footer = UNSAFE_getByType(JobFooter);
    expect(footer.props.onOpenChat).toBeDefined();

    await act(async () => {
      footer.props.onOpenChat!(mockJob);
    });

    expect(mockNav.navigate).toHaveBeenCalledWith(MainScreens.Chat, {
      deliveryId: 'del-job-chat-1',
      orderReference: 'ORD-9876',
    });
  });

  it('handles job with null orderReference by passing orderReference: null', async () => {
    const jobWithNullRef: Order = {
      ...mockJob,
      orderReference: undefined as any,
    };
    const { UNSAFE_getByType } = renderHome();

    const footer = UNSAFE_getByType(JobFooter);
    await act(async () => {
      footer.props.onOpenChat!(jobWithNullRef);
    });

    expect(mockNav.navigate).toHaveBeenCalledWith(MainScreens.Chat, {
      deliveryId: 'del-job-chat-1',
      orderReference: null,
    });
  });

  it('passes chatUnseen from useChatUnseen to JobFooter', () => {
    (useChatUnseen as jest.Mock).mockReturnValue(true);
    const { UNSAFE_getByType } = renderHome();

    const footer = UNSAFE_getByType(JobFooter);
    expect(footer.props.chatUnseen).toBe(true);
  });
});
