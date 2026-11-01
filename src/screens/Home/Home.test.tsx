import React from 'react';
import { Linking } from 'react-native';
import { render, act, fireEvent, cleanup } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActionSheet from 'react-native-action-sheet';
import { HomeScreen } from './Home';
import { Order, User, UserStatus } from '@app/types/types';
import { OrderSetting, OrderStatus } from '@app/types/enums';
import { InProgressCell } from '@app/components/InProgressCell/InProgressCell';
import { DispatchStopBanner } from '@app/components/DispatchStopBanner/DispatchStopBanner';
import { useDispatchState } from '@app/hooks/useDispatchState';
import { useJobContact } from '@app/hooks/useJobContact';
import { CUSTOMER_SMS_PRESETS, smsUrl } from '@app/utilities/jobContact';
import { DrawerScreens } from '@app/navigation/drawer/types';
import '@app/localization/i18n';

let mockIsFocused = true;

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
} as User;

jest.mock('@app/hooks/useUser', () => () => ({
  user: mockUser,
  isLoading: false,
  updateStatus: jest.fn(),
}));

const mockOrder: Order = {
  id: 'order-123',
  status: OrderStatus.dispatched,
  pickupLocation: { latitude: 39.36, longitude: 22.94 },
  dropoffLocation: { latitude: 39.37, longitude: 22.95 },
  pickupPhoneNumber: '111222333',
  dropoffPhoneNumber: '444555666',
  orderItems: [],
} as unknown as Order;

let mockHomeOrders = {
  dataSourceNew: [],
  dataSourceHistory: [],
  dataSourceInProgress: [mockOrder],
  timeLeftForOffer: jest.fn(),
  totalTimeForOffer: jest.fn(),
  waitedTimeForOffer: jest.fn(),
  refetchNew: jest.fn(),
  refetchInProgress: jest.fn(),
  refechHistory: jest.fn(),
  declineOrderFn: jest.fn(),
  acceptOrderFn: jest.fn(),
  isLoading: false,
};

jest.mock('@app/hooks/useHomeOrders', () => ({
  useHomeOrders: () => mockHomeOrders,
}));

describe('HomeScreen (Row 66, Clauses 1 & 5)', () => {
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

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockIsFocused = true;
    mockDispatchState = { current: null, next: null };
    mockJobContact = { dispatchPhoneNumber: '+302421012345' };
    testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockUser = {
      id: 'courier-1',
      status: UserStatus.Online,
      deliverySetting: OrderSetting.manual,
    } as User;
    openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    canOpenURLSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    openURLSpy.mockRestore();
    canOpenURLSpy.mockRestore();
    testQueryClient.clear();
    jest.useRealTimers();
  });

  describe('Clause 1: Map navigation to customer vs restaurant', () => {
    it('tapping customer address then choosing Google Maps routes to dropoff coordinates', async () => {
      const component = render(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      // Switch to InProgress tab where InProgressCell lives
      const inProgressTab = component.getByText(/in progress/i);
      fireEvent.press(inProgressTab);

      // Find InProgressCell
      const cells = component!.UNSAFE_getAllByType(InProgressCell);
      expect(cells.length).toBeGreaterThan(0);
      const cell = cells[0];

      // Tap customer address
      await act(async () => {
        cell.props.onCustomerAddressPress(mockOrder);
      });

      // ActionSheet was opened
      expect(ActionSheet.showActionSheetWithOptions).toHaveBeenCalled();
      const lastCall = (ActionSheet.showActionSheetWithOptions as jest.Mock)
        .mock.calls[
        (ActionSheet.showActionSheetWithOptions as jest.Mock).mock.calls
          .length - 1
      ];
      const config = lastCall[0];
      const onSelect = lastCall[1];

      // Find index of Google Maps option
      const googleIndex = config.options.findIndex((opt: string) =>
        opt.toLowerCase().includes('google'),
      );
      expect(googleIndex).toBeGreaterThanOrEqual(0);

      // Select Google Maps
      await act(async () => {
        onSelect(googleIndex);
      });

      // Linking.openURL called with customer dropoff coordinates (39.37, 22.95)
      expect(openURLSpy).toHaveBeenCalledTimes(1);
      const calledUrl = openURLSpy.mock.calls[0][0];
      expect(calledUrl).toContain('39.37,22.95');
      expect(calledUrl).not.toContain('39.36,22.94');
    });

    it('tapping restaurant address then choosing Google Maps routes to pickup coordinates', async () => {
      const component = render(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      const inProgressTab = component.getByText(/in progress/i);
      fireEvent.press(inProgressTab);

      const cells = component!.UNSAFE_getAllByType(InProgressCell);
      const cell = cells[0];

      // Tap restaurant address
      await act(async () => {
        cell.props.onRestaurantAddressPress(mockOrder);
      });

      expect(ActionSheet.showActionSheetWithOptions).toHaveBeenCalled();
      const lastCall = (ActionSheet.showActionSheetWithOptions as jest.Mock)
        .mock.calls[
        (ActionSheet.showActionSheetWithOptions as jest.Mock).mock.calls
          .length - 1
      ];
      const config = lastCall[0];
      const onSelect = lastCall[1];

      const googleIndex = config.options.findIndex((opt: string) =>
        opt.toLowerCase().includes('google'),
      );
      expect(googleIndex).toBeGreaterThanOrEqual(0);

      await act(async () => {
        onSelect(googleIndex);
      });

      // Linking.openURL called with restaurant pickup coordinates (39.36, 22.94)
      expect(openURLSpy).toHaveBeenCalledTimes(1);
      const calledUrl = openURLSpy.mock.calls[0][0];
      expect(calledUrl).toContain('39.36,22.94');
      expect(calledUrl).not.toContain('39.37,22.95');
    });
  });

  describe('Clause 5: Home renders without a user without crashing on deliverySetting', () => {
    it('uses user?.deliverySetting so rendering does not throw Cannot read property of undefined (deliverySetting)', () => {
      mockUser = undefined;
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        render(
          <QueryClientProvider client={testQueryClient}>
            <NavigationContainer>
              <HomeScreen navigation={mockNav} route={mockRoute} />
            </NavigationContainer>
          </QueryClientProvider>,
        );
      } catch (error: any) {
        // If line 63 has the old bug (user!.deliverySetting), it throws on 'deliverySetting'.
        // With the fix (user?.deliverySetting), line 63 does not crash.
        expect(error.message).not.toContain('deliverySetting');
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  describe('Clause 5: Home no longer refetches on every render (Row 67)', () => {
    it('uses a stable useCallback for useFocusEffect so re-rendering Home does not refetch in-progress or history orders again', () => {
      const component = render(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      // On initial focus/mount, focus effect runs once
      expect(mockHomeOrders.refetchInProgress).toHaveBeenCalledTimes(1);
      expect(mockHomeOrders.refechHistory).toHaveBeenCalledTimes(1);

      // Re-render HomeScreen with the same props
      component.rerender(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      // Callback identity remained stable via useCallback, so no second refetch storm
      expect(mockHomeOrders.refetchInProgress).toHaveBeenCalledTimes(1);
      expect(mockHomeOrders.refechHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dispatch stop banner (spec 0014, AC-7 and review fix af6d39c)', () => {
    it('renders the banner (testID dispatch-stop-banner) when dispatch state has a current stop', () => {
      mockDispatchState = {
        current: {
          reason: 'HEAT',
          startsAt: '2026-11-01T10:00:00Z',
          endsAt: '2026-11-01T15:00:00Z',
          message: 'Dispatch is stopped until 17:00 (heat).',
        },
        next: null,
      };

      const component = render(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      expect(component.getByTestId('dispatch-stop-banner')).toBeTruthy();
      expect(component.getByText('Dispatch stopped')).toBeTruthy();
      expect(
        component.getByText('Dispatch is stopped until 17:00 (heat).'),
      ).toBeTruthy();
    });

    it('does not render the banner when there is no current or upcoming stop', () => {
      mockDispatchState = {
        current: null,
        next: null,
      };

      const component = render(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      expect(component.queryByTestId('dispatch-stop-banner')).toBeNull();
    });

    it('passes useIsFocused value to DispatchStopBanner inFront prop', () => {
      // 1. When Home is focused (isFocused = true)
      mockIsFocused = true;
      const component1 = render(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );
      const banner1 = component1.UNSAFE_getByType(DispatchStopBanner);
      expect(banner1.props.inFront).toBe(true);
      expect(useDispatchState).toHaveBeenLastCalledWith(true);

      // 2. When Home is blurred (isFocused = false)
      mockIsFocused = false;
      const component2 = render(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );
      const banner2 = component2.UNSAFE_getByType(DispatchStopBanner);
      expect(banner2.props.inFront).toBe(false);
      expect(useDispatchState).toHaveBeenLastCalledWith(false);
    });
  });

  describe('Contact from the job (row 72, decisions 72.4, 72.5, 72.7)', () => {
    it('passes useIsFocused to useJobContact', () => {
      mockIsFocused = true;
      render(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );
      expect(useJobContact).toHaveBeenCalledWith(true);
    });

    it('wires onCallDispatch when dispatchPhoneNumber is returned and calls openURL with tel:<number>', async () => {
      mockJobContact = { dispatchPhoneNumber: '+302421012345' };

      const component = render(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      // Switch to InProgress tab
      fireEvent.press(component.getByText(/in progress/i));

      const cell = component.UNSAFE_getAllByType(InProgressCell)[0];
      expect(cell.props.onCallDispatch).toBeDefined();

      await act(async () => {
        cell.props.onCallDispatch();
      });

      expect(openURLSpy).toHaveBeenCalledWith('tel:+302421012345');
    });

    it('sets onCallDispatch to undefined when dispatchPhoneNumber is null', async () => {
      mockJobContact = { dispatchPhoneNumber: null };

      const component = render(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      fireEvent.press(component.getByText(/in progress/i));

      const cell = component.UNSAFE_getAllByType(InProgressCell)[0];
      expect(cell.props.onCallDispatch).toBeUndefined();
    });

    it('wires onCallCustomer to open tel:<customer number>', async () => {
      const component = render(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      fireEvent.press(component.getByText(/in progress/i));

      const cell = component.UNSAFE_getAllByType(InProgressCell)[0];
      await act(async () => {
        cell.props.onCallCustomer(mockOrder);
      });

      expect(openURLSpy).toHaveBeenCalledWith('tel:444555666');
    });

    it('wires onCallRestaurant to open tel:<restaurant number>', async () => {
      const component = render(
        <QueryClientProvider client={testQueryClient}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      fireEvent.press(component.getByText(/in progress/i));

      const cell = component.UNSAFE_getAllByType(InProgressCell)[0];
      await act(async () => {
        cell.props.onCallRestaurant(mockOrder);
      });

      expect(openURLSpy).toHaveBeenCalledWith('tel:111222333');
    });

    describe('showCustomerMessages preset options (decision 72.4)', () => {
      it('opens ActionSheet with preset messages and picking a preset opens sms:<number>?body=<encoded text>', async () => {
        const component = render(
          <QueryClientProvider client={testQueryClient}>
            <NavigationContainer>
              <HomeScreen navigation={mockNav} route={mockRoute} />
            </NavigationContainer>
          </QueryClientProvider>,
        );

        fireEvent.press(component.getByText(/in progress/i));

        const cell = component.UNSAFE_getAllByType(InProgressCell)[0];

        // Trigger onTextCustomer
        await act(async () => {
          cell.props.onTextCustomer(mockOrder);
        });

        expect(ActionSheet.showActionSheetWithOptions).toHaveBeenCalled();
        const [config, onSelect] = (
          ActionSheet.showActionSheetWithOptions as jest.Mock
        ).mock.calls[
          (ActionSheet.showActionSheetWithOptions as jest.Mock).mock.calls
            .length - 1
        ];

        expect(config.title).toBe('Text the customer');
        expect(config.cancelButtonIndex).toBe(3);
        expect(config.options).toEqual([
          "I'm outside",
          'Arriving in 5 min',
          "Can't find the entrance",
          'Cancel',
        ]);

        // Select preset 0: Outside
        await act(async () => {
          onSelect(0);
        });

        expect(openURLSpy).toHaveBeenCalledWith(
          smsUrl(mockOrder.dropoffPhoneNumber!, CUSTOMER_SMS_PRESETS[0].body),
        );

        // Select preset 1: Arriving in 5
        await act(async () => {
          onSelect(1);
        });

        expect(openURLSpy).toHaveBeenCalledWith(
          smsUrl(mockOrder.dropoffPhoneNumber!, CUSTOMER_SMS_PRESETS[1].body),
        );

        // Select preset 2: Can't find entrance
        await act(async () => {
          onSelect(2);
        });

        expect(openURLSpy).toHaveBeenCalledWith(
          smsUrl(mockOrder.dropoffPhoneNumber!, CUSTOMER_SMS_PRESETS[2].body),
        );
      });

      it('selecting Cancel or dismissing ActionSheet opens nothing', async () => {
        const component = render(
          <QueryClientProvider client={testQueryClient}>
            <NavigationContainer>
              <HomeScreen navigation={mockNav} route={mockRoute} />
            </NavigationContainer>
          </QueryClientProvider>,
        );

        fireEvent.press(component.getByText(/in progress/i));

        const cell = component.UNSAFE_getAllByType(InProgressCell)[0];

        await act(async () => {
          cell.props.onTextCustomer(mockOrder);
        });

        const [, onSelect] = (
          ActionSheet.showActionSheetWithOptions as jest.Mock
        ).mock.calls[
          (ActionSheet.showActionSheetWithOptions as jest.Mock).mock.calls
            .length - 1
        ];

        openURLSpy.mockClear();

        // Cancel index (3)
        await act(async () => {
          onSelect(3);
        });
        expect(openURLSpy).not.toHaveBeenCalled();

        // Dismiss outside (undefined)
        await act(async () => {
          onSelect(undefined);
        });
        expect(openURLSpy).not.toHaveBeenCalled();
      });

      it('does nothing when order has no dropoffPhoneNumber', async () => {
        const component = render(
          <QueryClientProvider client={testQueryClient}>
            <NavigationContainer>
              <HomeScreen navigation={mockNav} route={mockRoute} />
            </NavigationContainer>
          </QueryClientProvider>,
        );

        fireEvent.press(component.getByText(/in progress/i));

        const cell = component.UNSAFE_getAllByType(InProgressCell)[0];

        const orderWithoutNumber = {
          ...mockOrder,
          dropoffPhoneNumber: undefined,
        };

        const sheetCallsBefore = (
          ActionSheet.showActionSheetWithOptions as jest.Mock
        ).mock.calls.length;

        await act(async () => {
          cell.props.onTextCustomer(orderWithoutNumber);
        });

        expect(
          (ActionSheet.showActionSheetWithOptions as jest.Mock).mock.calls
            .length,
        ).toBe(sheetCallsBefore);
        expect(openURLSpy).not.toHaveBeenCalled();
      });
    });
  });
});
