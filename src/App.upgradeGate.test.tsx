import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import '@app/localization/i18n';
import App from '../App';
import { queryPersister } from '@app/services/queryPersistence';

let activeQueryClient: QueryClient | undefined;

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    QueryClient: class extends actual.QueryClient {
      constructor(config?: any) {
        super(config);
        activeQueryClient = this as unknown as QueryClient;
      }
    },
  };
});

const mockRunUpgradeGate = jest.fn();

jest.mock('@app/services/upgradeGate', () => ({
  runUpgradeGate: () => mockRunUpgradeGate(),
}));

jest.mock('@app/services/liveConnection', () => {
  const actual = jest.requireActual('@app/services/liveConnection');
  return {
    ...actual,
    createCourierSocket: jest.fn(),
  };
});

const mockGetUser = jest.fn();

jest.mock('@app/services/service', () => ({
  services: {
    userService: {
      getUser: () => mockGetUser(),
      setUserStatus: jest.fn().mockResolvedValue({}),
      setDeliverySettings: jest.fn().mockResolvedValue({}),
      setUserLocation: jest.fn().mockResolvedValue({}),
    },
    orderService: {
      getNewOrders: jest.fn().mockResolvedValue([]),
      getInProgressOrders: jest.fn().mockResolvedValue([]),
      getOrdersHistory: jest.fn().mockResolvedValue([]),
      acceptOrder: jest.fn().mockResolvedValue({}),
      declineOrder: jest.fn().mockResolvedValue({}),
    },
  },
}));

describe('App upgrade gate (spec 0039, AC-3)', () => {
  let resolveGate: () => void;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    await AsyncStorage.clear();
    activeQueryClient?.clear();
    mockGetUser.mockRejectedValue(new Error('401 Unauthorized'));
    const gatePromise = new Promise<void>(resolve => {
      resolveGate = resolve;
    });
    mockRunUpgradeGate.mockReturnValue(gatePromise);
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
  });

  it('draws nothing and does not restore persisted queries before runUpgradeGate resolves, then draws after', async () => {
    const restoreSpy = jest.spyOn(queryPersister, 'restoreClient');

    const { toJSON } = render(<App />);

    // Before gate resolves: nothing is drawn and persister has not been invoked
    expect(toJSON()).toBeNull();
    expect(restoreSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(i18n.t('translations:log_in'))).toBeNull();

    // Now resolve the upgrade gate
    await act(async () => {
      resolveGate();
    });

    // After gate resolves: persister restores and the app draws (Login screen)
    expect(restoreSpy).toHaveBeenCalled();
    const login = await screen.findByText(i18n.t('translations:log_in'));
    expect(login).toBeTruthy();

    restoreSpy.mockRestore();
  });
});
