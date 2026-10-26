import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SideMenuItem, UserStatus } from '@app/types/types';
import { LOGOUT_OFFLINE_TIMEOUT_MS } from '@app/utilities/constants';
import '@app/localization/i18n';

// Mock dependencies of SideMenu
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-navigation/drawer', () => {
  const { View } = require('react-native');
  return {
    DrawerContentScrollView: ({ children }: { children: React.ReactNode }) => (
      <View testID="drawer-scroll">{children}</View>
    ),
  };
});

const mockSetUserStatus = jest.fn();
const mockLogout = jest.fn();
const mockUserData = {
  id: 'courier-1',
  status: 'ONLINE',
  deliverySetting: 'MANUAL',
  name: 'Courier User',
};

jest.mock('@app/services/service', () => ({
  services: {
    userService: {
      setUserStatus: (...args: any[]) => mockSetUserStatus(...args),
    },
    logout: () => mockLogout(),
  },
}));

jest.mock('@app/hooks/useUser', () => () => ({
  user: mockUserData,
  updateStatus: jest.fn(),
  updateDeliverySettings: jest.fn(),
  updateUserLocation: jest.fn(),
}));

jest.mock('@app/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    locationPermission: false,
    requestLocationPermission: jest.fn(),
  }),
}));

jest.mock('@app/hooks/useInstance', () => () => ({
  userInstances: [],
  isLoadingInstances: false,
}));

import { SideMenu } from './SideMenu';
import { SideMenuItemPlain } from '@app/components/SideMenuItemPlain/SideMenuItemPlain';

describe('SideMenu logout (spec 0002, AC-6)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;
  let resetQueriesSpy: jest.SpyInstance;
  let multiRemoveSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetUserStatus.mockResolvedValue({});
    mockLogout.mockReturnValue(undefined);

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    resetQueriesSpy = jest.spyOn(queryClient, 'resetQueries');
    multiRemoveSpy = jest.spyOn(AsyncStorage, 'multiRemove');
  });

  afterEach(() => {
    alertSpy.mockRestore();
    queryClient.clear();
  });

  const renderSideMenu = () => {
    const mockNavigation: any = {
      navigate: jest.fn(),
      closeDrawer: jest.fn(),
    };

    return renderer.create(
      <QueryClientProvider client={queryClient}>
        <SideMenu {...({ navigation: mockNavigation } as any)} />
      </QueryClientProvider>,
    );
  };

  it('sets rider Offline before clearing session on logout', async () => {
    const executionOrder: string[] = [];

    mockSetUserStatus.mockImplementation(async (status: UserStatus) => {
      executionOrder.push(`setUserStatus:${status}`);
      return {};
    });

    multiRemoveSpy.mockImplementation(async (keys: string[]) => {
      executionOrder.push(`multiRemove:${keys.join(',')}`);
    });

    mockLogout.mockImplementation(() => {
      executionOrder.push('logout');
    });

    resetQueriesSpy.mockImplementation(async () => {
      executionOrder.push('resetQueries');
    });

    const component = renderSideMenu();

    // Find the Logout item
    const plainItems = component.root.findAllByType(SideMenuItemPlain);
    const logoutItem = plainItems.find(
      item => item.props.item === SideMenuItem.Logout,
    );
    expect(logoutItem).toBeDefined();

    // Press Logout
    act(() => {
      logoutItem!.props.onPress(SideMenuItem.Logout);
    });

    // Confirmation Alert shown
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const alertButtons = alertSpy.mock.calls[0][2];
    const yesButton = alertButtons.find((btn: any) => btn.text === 'Yes');
    expect(yesButton).toBeDefined();

    // Confirm logout
    await act(async () => {
      await yesButton.onPress();
    });

    // 1. Sets status Offline first with 3s timeout (M5)
    expect(mockSetUserStatus).toHaveBeenCalledTimes(1);
    expect(mockSetUserStatus).toHaveBeenCalledWith(UserStatus.Offline, {
      timeoutMs: LOGOUT_OFFLINE_TIMEOUT_MS,
    });

    // 2. Clears storage, logs out, and resets queries
    expect(multiRemoveSpy).toHaveBeenCalledWith([
      'token',
      'BASE_URL',
      'SOCKET_BASE_URL',
    ]);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(resetQueriesSpy).toHaveBeenCalledTimes(1);

    // Verify strict order: Offline PATCH occurs BEFORE storage clearance and logout
    expect(executionOrder).toEqual([
      'setUserStatus:OFFLINE',
      'multiRemove:token,BASE_URL,SOCKET_BASE_URL',
      'logout',
      'resetQueries',
    ]);
  });

  it('still logs out and clears session when setUserStatus fails (e.g. no network)', async () => {
    // Network error when attempting to go Offline
    mockSetUserStatus.mockRejectedValueOnce(
      new Error('Network request failed'),
    );

    const component = renderSideMenu();

    const plainItems = component.root.findAllByType(SideMenuItemPlain);
    const logoutItem = plainItems.find(
      item => item.props.item === SideMenuItem.Logout,
    );

    act(() => {
      logoutItem!.props.onPress(SideMenuItem.Logout);
    });

    const alertButtons = alertSpy.mock.calls[0][2];
    const yesButton = alertButtons.find((btn: any) => btn.text === 'Yes');

    // Confirm logout despite error
    await act(async () => {
      await yesButton.onPress();
    });

    expect(mockSetUserStatus).toHaveBeenCalledWith(UserStatus.Offline, {
      timeoutMs: LOGOUT_OFFLINE_TIMEOUT_MS,
    });

    // AsyncStorage, logout and query reset MUST still happen so user is not stuck logged in
    expect(multiRemoveSpy).toHaveBeenCalledWith([
      'token',
      'BASE_URL',
      'SOCKET_BASE_URL',
    ]);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(resetQueriesSpy).toHaveBeenCalledTimes(1);
  });
});
