import React from 'react';
import { Linking } from 'react-native';
import { render, act, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActionSheet from 'react-native-action-sheet';
import { HomeScreen } from './Home';
import { Order, User, UserStatus } from '@app/types/types';
import { OrderSetting, OrderStatus } from '@app/types/enums';
import { InProgressCell } from '@app/components/InProgressCell/InProgressCell';
import { DrawerScreens } from '@app/navigation/drawer/types';
import '@app/localization/i18n';

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
    jest.clearAllMocks();
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
    openURLSpy.mockRestore();
    canOpenURLSpy.mockRestore();
    testQueryClient.clear();
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
});
