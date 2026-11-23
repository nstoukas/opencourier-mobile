import React from 'react';
import { render, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { HomeScreen } from './Home';
import { Order, StackStop, User, UserStatus } from '@app/types/types';
import { OrderSetting, OrderStatus } from '@app/types/enums';
import { NewOrderCell } from '@app/components/NewOrderCell/NewOrderCell';
import { StackOfferCell } from '@app/components/StackOfferCell/StackOfferCell';
import { AddOnOfferCell } from '@app/components/AddOnOfferCell/AddOnOfferCell';
import { OfferAnswers } from '@app/components/OfferAnswers/OfferAnswers';

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
    requestLocationPermission: jest.fn(),
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

jest.mock('@app/hooks/useChat', () => ({
  useChatUnseen: () => 0,
}));

let mockHomeOrders = {
  dataSourceNew: [] as Order[],
  dataSourceInProgress: [] as Order[],
  serverInProgress: [] as Order[],
  handAnswerIds: [] as string[],
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

describe('Home offer answers pinned in footer (Clause 6)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    mockUser.status = UserStatus.Online;
    mockUser.deliverySetting = OrderSetting.manual;
  });

  afterEach(() => {
    queryClient.clear();
    jest.useRealTimers();
  });

  const renderHome = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <HomeScreen
            navigation={{ navigate: jest.fn(), toggleDrawer: jest.fn() } as any}
            route={{ key: 'home', name: 'Home' } as any}
          />
        </NavigationContainer>
      </QueryClientProvider>,
    );

  const singleOffer: Order = {
    id: 'single-offer-1',
    currencyCode: 'EUR',
    deliveryFee: 450,
    pickupLocation: { latitude: 39.36, longitude: 22.94 },
    dropoffLocation: { latitude: 39.37, longitude: 22.95 },
    pickupBusinessName: 'Pizza Roma',
    dropoffArea: 'Center',
  } as unknown as Order;

  it('pins OfferAnswers in footer with accept / slide_to_accept for single offer, passing answersBelow to NewOrderCell', () => {
    mockHomeOrders.dataSourceNew = [singleOffer];
    mockHomeOrders.dataSourceInProgress = [];
    mockHomeOrders.serverInProgress = [];

    const { UNSAFE_getByType, unmount } = renderHome();

    // NewOrderCell is rendered with answersBelow={true}
    const cell = UNSAFE_getByType(NewOrderCell);
    expect(cell.props.answersBelow).toBe(true);

    // OfferAnswers is rendered in the footer with pinned={true}
    const answers = UNSAFE_getByType(OfferAnswers);
    expect(answers.props.pinned).toBe(true);
    expect(answers.props.acceptTitle).toBe(i18n.t('translations:accept'));
    expect(answers.props.acceptSubtitle).toBe(
      i18n.t('translations:slide_to_accept'),
    );

    // Accepting calls acceptOrderFn with the offer id
    act(() => {
      answers.props.onAccept(singleOffer);
    });
    expect(mockHomeOrders.acceptOrderFn).toHaveBeenCalledWith('single-offer-1');

    // Declining calls declineOrderFn with the offer id
    act(() => {
      answers.props.onDecline(singleOffer);
    });
    expect(mockHomeOrders.declineOrderFn).toHaveBeenCalledWith(
      'single-offer-1',
    );

    unmount();
  });

  it('pins OfferAnswers in footer with stack_offer_accept / stack_offer_slide for pair offer, passing answersBelow to StackOfferCell', () => {
    const stops: StackStop[] = [
      { deliveryId: 'stack-1', stop: 'PICKUP' },
      { deliveryId: 'stack-2', stop: 'PICKUP' },
      { deliveryId: 'stack-1', stop: 'DROPOFF' },
      { deliveryId: 'stack-2', stop: 'DROPOFF' },
    ];
    const pair1: Order = {
      id: 'stack-1',
      offerGroupId: 'group-pair-1',
      stackStops: stops,
      currencyCode: 'EUR',
      deliveryFee: 400,
      pickupBusinessName: 'Pizza Roma',
      dropoffArea: 'Center',
    } as unknown as Order;
    const pair2: Order = {
      id: 'stack-2',
      offerGroupId: 'group-pair-1',
      stackStops: stops,
      currencyCode: 'EUR',
      deliveryFee: 420,
      pickupBusinessName: 'Burger House',
      dropoffArea: 'Port',
    } as unknown as Order;

    mockHomeOrders.dataSourceNew = [pair1, pair2];
    mockHomeOrders.dataSourceInProgress = [];
    mockHomeOrders.serverInProgress = [];

    const { UNSAFE_getByType, unmount } = renderHome();

    // StackOfferCell is rendered with answersBelow={true}
    const cell = UNSAFE_getByType(StackOfferCell);
    expect(cell.props.answersBelow).toBe(true);

    // OfferAnswers is rendered in footer with pinned={true} and stack offer words
    const answers = UNSAFE_getByType(OfferAnswers);
    expect(answers.props.pinned).toBe(true);
    expect(answers.props.acceptTitle).toBe(
      i18n.t('translations:stack_offer_accept'),
    );
    expect(answers.props.acceptSubtitle).toBe(
      i18n.t('translations:stack_offer_slide'),
    );

    // Accepting calls acceptOrderFn with pair1.id
    act(() => {
      answers.props.onAccept(pair1);
    });
    expect(mockHomeOrders.acceptOrderFn).toHaveBeenCalledWith('stack-1');

    // Declining calls declineOrderFn with pair1.id
    act(() => {
      answers.props.onDecline(pair1);
    });
    expect(mockHomeOrders.declineOrderFn).toHaveBeenCalledWith('stack-1');

    unmount();
  });

  it('pins OfferAnswers in footer with add_on_offer_accept / add_on_offer_slide for add on offer, passing answersBelow to AddOnOfferCell', () => {
    const heldJob: Order = {
      id: 'held-job-1',
      status: OrderStatus.dispatched,
      currencyCode: 'EUR',
      deliveryFee: 400,
    } as unknown as Order;

    const addOnStops: StackStop[] = [
      { deliveryId: 'held-job-1', stop: 'PICKUP' },
      { deliveryId: 'addon-offer-1', stop: 'PICKUP' },
      { deliveryId: 'held-job-1', stop: 'DROPOFF' },
      { deliveryId: 'addon-offer-1', stop: 'DROPOFF' },
    ];

    const addOnOffer: Order = {
      id: 'addon-offer-1',
      addOn: true,
      currencyCode: 'EUR',
      deliveryFee: 350,
      extraKm: 1.2,
      extraMinutes: 4,
      stackStops: addOnStops,
    } as unknown as Order;

    mockHomeOrders.dataSourceNew = [addOnOffer];
    mockHomeOrders.dataSourceInProgress = [heldJob];
    mockHomeOrders.serverInProgress = [heldJob];

    const { UNSAFE_getByType, unmount } = renderHome();

    // AddOnOfferCell is rendered with answersBelow={true}
    const cell = UNSAFE_getByType(AddOnOfferCell);
    expect(cell.props.answersBelow).toBe(true);

    // OfferAnswers is rendered in footer with pinned={true} and add-on words
    const answers = UNSAFE_getByType(OfferAnswers);
    expect(answers.props.pinned).toBe(true);
    expect(answers.props.acceptTitle).toBe(
      i18n.t('translations:add_on_offer_accept'),
    );
    expect(answers.props.acceptSubtitle).toBe(
      i18n.t('translations:add_on_offer_slide'),
    );

    // Accepting calls acceptOrderFn with addon id
    act(() => {
      answers.props.onAccept(addOnOffer);
    });
    expect(mockHomeOrders.acceptOrderFn).toHaveBeenCalledWith('addon-offer-1');

    // Declining calls declineOrderFn with addon id
    act(() => {
      answers.props.onDecline(addOnOffer);
    });
    expect(mockHomeOrders.declineOrderFn).toHaveBeenCalledWith('addon-offer-1');

    unmount();
  });
});
