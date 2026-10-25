import React from 'react';
import { render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';

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

import '@app/localization/i18n';
import App from '../App';
import { User, UserStatus } from '@app/types/types';
import { OrderSetting } from '@app/types/enums';

// Fake socket class to intercept socket connection through row 57's seam
class FakeSocket {
  connected = false;
  active = true;
  events = new Map<string, Array<(...args: any[]) => void>>();
  connectCalls = 0;
  disconnectCalls = 0;
  removeAllListenersCalls = 0;

  constructor(public readonly url: string, public readonly token: string) {}

  on(event: string, listener: (...args: any[]) => void) {
    const list = this.events.get(event) ?? [];
    list.push(listener);
    this.events.set(event, list);
    return this;
  }

  emit(event: string, ...args: any[]) {
    const list = this.events.get(event) ?? [];
    for (const listener of [...list]) {
      listener(...args);
    }
  }

  connect() {
    this.connectCalls++;
  }

  disconnect() {
    this.disconnectCalls++;
  }

  removeAllListeners() {
    this.removeAllListenersCalls++;
    this.events.clear();
  }
}

const mockCreateCourierSocket = jest.fn(
  (url: string, token: string) => new FakeSocket(url, token),
);

// Intercept socket creation seam so tests never touch the network
jest.mock('@app/services/liveConnection', () => {
  const actual = jest.requireActual('@app/services/liveConnection');
  return {
    ...actual,
    createCourierSocket: (url: string, token: string) =>
      mockCreateCourierSocket(url, token),
  };
});

const mockGetUser = jest.fn();
const mockGetNewOrders = jest.fn();
const mockGetInProgressOrders = jest.fn();
const mockGetOrdersHistory = jest.fn();
const mockGetUserInstances = jest.fn();
const mockGetInstanceMetadata = jest.fn();

jest.mock('@app/services/service', () => ({
  services: {
    userService: {
      getUser: () => mockGetUser(),
      setUserStatus: jest.fn().mockResolvedValue({}),
      setDeliverySettings: jest.fn().mockResolvedValue({}),
      setUserLocation: jest.fn().mockResolvedValue({}),
    },
    orderService: {
      getNewOrders: () => mockGetNewOrders(),
      getInProgressOrders: () => mockGetInProgressOrders(),
      getOrdersHistory: () => mockGetOrdersHistory(),
      acceptOrder: jest.fn().mockResolvedValue({}),
      declineOrder: jest.fn().mockResolvedValue({}),
    },
    instanceService: {
      getUserInstances: () => mockGetUserInstances(),
      getInstanceMetadata: (link: string) => mockGetInstanceMetadata(link),
    },
  },
}));

const mockCourierUser: User = {
  id: 'courier-1',
  userId: 'user-1',
  email: 'rider@example.com',
  role: ['courier'],
  firstName: 'Nikos',
  lastName: 'Courier',
  status: UserStatus.Online,
  deliverySetting: OrderSetting.manual,
  node_uri: 'http://localhost:3000',
  createdAt: '2026-01-01T00:00:00.000Z',
  currentLocation: {
    latitude: 39.36,
    longitude: 22.94,
  },
};

describe('App smoke tests', () => {
  beforeEach(async () => {
    // Fake timers prevent React Query's gc and retry timers from keeping Jest alive
    jest.useFakeTimers();
    jest.clearAllMocks();
    await AsyncStorage.clear();
    activeQueryClient?.clear();
    mockGetNewOrders.mockResolvedValue([]);
    mockGetInProgressOrders.mockResolvedValue([]);
    mockGetOrdersHistory.mockResolvedValue([]);
    mockGetUserInstances.mockResolvedValue([]);
    mockGetInstanceMetadata.mockResolvedValue({});
  });

  it('renders logged out: passes through Loading and reaches Landing (AC-4)', async () => {
    // Logged out: /auth/me rejects (e.g. 401) and AsyncStorage has no token
    mockGetUser.mockRejectedValue(new Error('401 Unauthorized'));

    render(<App />);

    const landing = await screen.findByTestId('landing-screen');
    expect(landing).toBeTruthy();
    expect(mockGetUser).toHaveBeenCalled();
  });

  it('renders logged in: exercises providers and reaches Home (AC-5)', async () => {
    const fakeToken = 'test-token';
    const fakeBaseUrl = 'http://localhost:3000/api/courier/v1';
    const fakeSocketUrl = 'http://localhost:3000';

    await AsyncStorage.multiSet([
      ['token', fakeToken],
      ['BASE_URL', fakeBaseUrl],
      ['SOCKET_BASE_URL', fakeSocketUrl],
    ]);

    mockGetUser.mockResolvedValue(mockCourierUser);

    render(<App />);

    const home = await screen.findByTestId('home-screen');
    expect(home).toBeTruthy();
    expect(mockGetUser).toHaveBeenCalled();
    expect(mockCreateCourierSocket).toHaveBeenCalledWith(
      fakeSocketUrl,
      fakeToken,
    );
  });
});
