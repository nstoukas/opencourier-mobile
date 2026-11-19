import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Socket } from 'socket.io-client';
import '@app/localization/i18n';
import { REMOVAL_REQUEST_DECIDED_EVENT } from './liveConnection';
import { receiveRemovalDecision } from './removalNotice/removalNotice';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('./removalNotice/removalNotice', () => ({
  receiveRemovalDecision: jest.fn(() => Promise.resolve()),
}));

class MockFakeSocket {
  connected = false;
  active = true;
  events = new Map<string, Array<(...args: any[]) => void>>();
  on(event: string, listener: (...args: any[]) => void) {
    const list = this.events.get(event) ?? [];
    list.push(listener);
    this.events.set(event, list);
    return this;
  }
  emit(event: string, ...args: any[]) {
    for (const listener of [...(this.events.get(event) ?? [])]) {
      listener(...args);
    }
  }
  connect() {}
  disconnect() {}
  removeAllListeners() {
    this.events.clear();
  }
}

let mockLatestSocket: MockFakeSocket | null = null;

jest.mock('./liveConnection', () => {
  const actual = jest.requireActual('./liveConnection');
  return {
    ...actual,
    createCourierSocket: () => {
      mockLatestSocket = new MockFakeSocket();
      return mockLatestSocket as unknown as Socket;
    },
  };
});

jest.mock('@app/hooks/useUser', () => () => ({
  user: { id: 'courier-1', status: 'ONLINE' },
  isLoading: false,
  refetchUser: jest.fn(),
}));

jest.mock('@app/services/service', () => ({
  services: {
    orderService: {
      getInProgressOrders: jest.fn(() => Promise.resolve([])),
    },
  },
}));

import SocketProvider from './socket';

describe('SocketProvider REMOVAL_REQUEST_DECIDED (spec 0035, AC-11)', () => {
  let queryClient: QueryClient;
  let tree: renderer.ReactTestRenderer;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLatestSocket = null;
    await AsyncStorage.setItem('token', 'courier-jwt-token');
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: Infinity },
      },
    });
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={queryClient}>
          <SocketProvider>{null}</SocketProvider>
        </QueryClientProvider>,
      );
    });
  });

  afterEach(() => {
    act(() => {
      tree.unmount();
    });
    queryClient.clear();
  });

  it('routes socket REMOVAL_REQUEST_DECIDED to receiveRemovalDecision with queryClient', async () => {
    const message = {
      deliveryId: 'del-socket-removal',
      outcome: 'APPROVED',
      decisionNote: null,
      paid: true,
      payAmount: 350,
      currencyCode: 'EUR',
    };

    await act(async () => {
      mockLatestSocket!.emit(REMOVAL_REQUEST_DECIDED_EVENT, message);
    });

    expect(receiveRemovalDecision).toHaveBeenCalledWith(
      message,
      expect.any(Object),
    );
  });
});
