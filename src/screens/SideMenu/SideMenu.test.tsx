import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from 'react-native-geolocation-service';
import { SideMenuItem, UserStatus } from '@app/types/types';
import { LOGOUT_OFFLINE_TIMEOUT_MS } from '@app/utilities/constants';
import * as jobStepOutbox from '@app/services/jobStepOutbox';
import * as queryPersistence from '@app/services/queryPersistence';
import i18n from '@app/localization/i18n';

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
const mockUnregisterThisPhone = jest.fn();
const mockUserData = {
  id: 'courier-1',
  status: 'ONLINE',
  deliverySetting: 'MANUAL',
  name: 'Courier User',
};

jest.mock('@app/services/offerPush/registration', () => ({
  unregisterThisPhone: (...args: any[]) => mockUnregisterThisPhone(...args),
}));

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
}));

const mockRequestLocationPermission = jest.fn();
jest.mock('@app/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    locationPermission: false,
    requestLocationPermission: () => mockRequestLocationPermission(),
  }),
}));

jest.mock('@app/hooks/useInstance', () => () => ({
  userInstances: [],
  isLoadingInstances: false,
}));

import { SideMenu } from './SideMenu';
import { SideMenuItemPlain } from '@app/components/SideMenuItemPlain/SideMenuItemPlain';
import { SideMenuItemSwitch } from '@app/components/SideMenuItemSwitch/SideMenuItemSwitch';

describe('SideMenu logout (spec 0002, AC-6; spec 0009, AC-8, AC-11)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;
  let resetQueriesSpy: jest.SpyInstance;
  let multiRemoveSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnregisterThisPhone.mockResolvedValue(undefined);
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

  it('refuses logout with an alert naming the count when rider has waiting steps, and does not call logout (AC-8)', async () => {
    jest.spyOn(jobStepOutbox, 'waitingCount').mockResolvedValue(3);

    const component = renderSideMenu();

    const plainItems = component.root.findAllByType(SideMenuItemPlain);
    const logoutItem = plainItems.find(
      item => item.props.item === SideMenuItem.Logout,
    );
    expect(logoutItem).toBeDefined();

    act(() => {
      logoutItem!.props.onPress(SideMenuItem.Logout);
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(1);
    });
    expect(alertSpy).toHaveBeenCalledWith(
      i18n.t('translations:logout_waiting_title'),
      i18n.t('translations:logout_waiting_body', { count: 3 }),
    );

    expect(mockUnregisterThisPhone).not.toHaveBeenCalled();
    expect(mockSetUserStatus).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(multiRemoveSpy).not.toHaveBeenCalled();
  });

  it('fails closed when waitingCount rejects: shows alert that phone could not check, logout is not called, and no confirmation is offered (AC-8)', async () => {
    jest
      .spyOn(jobStepOutbox, 'waitingCount')
      .mockRejectedValue(new Error('Storage failure'));

    const component = renderSideMenu();

    const plainItems = component.root.findAllByType(SideMenuItemPlain);
    const logoutItem = plainItems.find(
      item => item.props.item === SideMenuItem.Logout,
    );
    expect(logoutItem).toBeDefined();

    act(() => {
      logoutItem!.props.onPress(SideMenuItem.Logout);
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(1);
    });
    expect(alertSpy).toHaveBeenCalledWith(
      i18n.t('translations:logout_waiting_title'),
      i18n.t('translations:logout_outbox_unreadable'),
    );
    // No confirmation buttons offered (alert called with title and message only)
    expect(alertSpy.mock.calls[0][2]).toBeUndefined();

    expect(mockUnregisterThisPhone).not.toHaveBeenCalled();
    expect(mockSetUserStatus).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(multiRemoveSpy).not.toHaveBeenCalled();
  });

  it('sets rider Offline before clearing session on logout and calls clearSavedQueries when no steps wait (AC-8, AC-11)', async () => {
    jest.spyOn(jobStepOutbox, 'waitingCount').mockResolvedValue(0);
    const clearSavedQueriesSpy = jest.spyOn(
      queryPersistence,
      'clearSavedQueries',
    );

    const executionOrder: string[] = [];

    mockUnregisterThisPhone.mockImplementation(async () => {
      executionOrder.push('unregisterThisPhone');
    });

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
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(1);
    });
    const alertButtons = alertSpy.mock.calls[0][2];
    const yesButton = alertButtons.find((btn: any) => btn.text === 'Yes');
    expect(yesButton).toBeDefined();

    // Confirm logout
    await act(async () => {
      await yesButton.onPress();
    });

    // 1. Unregisters phone first with 3s timeout (AC-1)
    expect(mockUnregisterThisPhone).toHaveBeenCalledTimes(1);
    expect(mockUnregisterThisPhone).toHaveBeenCalledWith(
      LOGOUT_OFFLINE_TIMEOUT_MS,
    );

    // 2. Sets status Offline first with 3s timeout (M5)
    expect(mockSetUserStatus).toHaveBeenCalledTimes(1);
    expect(mockSetUserStatus).toHaveBeenCalledWith(UserStatus.Offline, {
      timeoutMs: LOGOUT_OFFLINE_TIMEOUT_MS,
    });

    // 3. Clears storage (including refreshToken, row 66), logs out, and resets queries
    expect(multiRemoveSpy).toHaveBeenCalledWith([
      'token',
      'refreshToken',
      'BASE_URL',
      'SOCKET_BASE_URL',
    ]);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(resetQueriesSpy).toHaveBeenCalledTimes(1);
    expect(clearSavedQueriesSpy).toHaveBeenCalledTimes(1);

    // Verify strict order: unregister and Offline occur BEFORE storage clearance, logout and query cache clearance
    expect(executionOrder).toEqual([
      'unregisterThisPhone',
      'setUserStatus:OFFLINE',
      'multiRemove:token,refreshToken,BASE_URL,SOCKET_BASE_URL',
      'logout',
      'resetQueries',
      'multiRemove:queryCache',
    ]);
  });

  it('still logs out and clears session when setUserStatus fails (e.g. no network)', async () => {
    jest.spyOn(jobStepOutbox, 'waitingCount').mockResolvedValue(0);
    const clearSavedQueriesSpy = jest.spyOn(
      queryPersistence,
      'clearSavedQueries',
    );
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

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(1);
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

    // AsyncStorage, logout, query reset and queryCache clear MUST still happen so user is not stuck logged in
    expect(multiRemoveSpy).toHaveBeenCalledWith([
      'token',
      'refreshToken',
      'BASE_URL',
      'SOCKET_BASE_URL',
    ]);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(resetQueriesSpy).toHaveBeenCalledTimes(1);
    expect(clearSavedQueriesSpy).toHaveBeenCalledTimes(1);
  });
});

describe('SideMenu Location switch (Row 67, Clause 3)', () => {
  let queryClient: QueryClient;
  let openSettingsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
      },
    });
    openSettingsSpy = jest
      .spyOn(Linking, 'openSettings')
      .mockImplementation(() => Promise.resolve() as any);
  });

  afterEach(() => {
    openSettingsSpy.mockRestore();
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

  it('switching Location switch on calls requestLocationPermission and never calls watchPosition', () => {
    const component = renderSideMenu();
    const switches = component.root.findAllByType(SideMenuItemSwitch);
    const locationSwitch = switches.find(
      s => s.props.item === SideMenuItem.Location,
    );
    expect(locationSwitch).toBeDefined();

    act(() => {
      locationSwitch!.props.onValueChange(true);
    });

    expect(mockRequestLocationPermission).toHaveBeenCalledTimes(1);
    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
    expect(openSettingsSpy).not.toHaveBeenCalled();
  });

  it('switching Location switch off calls Linking.openSettings and never calls watchPosition', () => {
    const component = renderSideMenu();
    const switches = component.root.findAllByType(SideMenuItemSwitch);
    const locationSwitch = switches.find(
      s => s.props.item === SideMenuItem.Location,
    );
    expect(locationSwitch).toBeDefined();

    act(() => {
      locationSwitch!.props.onValueChange(false);
    });

    expect(openSettingsSpy).toHaveBeenCalledTimes(1);
    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
    expect(mockRequestLocationPermission).not.toHaveBeenCalled();
  });
});
