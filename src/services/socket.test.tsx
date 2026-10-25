import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { AppState, AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserStatus } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import { LiveConnectionHandlers } from './liveConnection';

// Mock AsyncStorage using the official jest mock
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockUser: { id: string; status: UserStatus } | null = {
  id: 'courier-1',
  status: UserStatus.Online,
};

jest.mock('@app/hooks/useUser', () => () => ({
  user: mockUser,
  isLoading: false,
  refetchUser: jest.fn(),
}));

jest.mock('@app/services/service', () => ({
  services: {
    orderService: {
      getInProgressOrders: jest.fn().mockResolvedValue([]),
    },
  },
}));

let lastHandlers: LiveConnectionHandlers;
let mockLiveConnectionInstance: {
  open: jest.Mock;
  close: jest.Mock;
  resume: jest.Mock;
  getStatus: jest.Mock;
};

jest.mock('./liveConnection', () => {
  const actual = jest.requireActual('./liveConnection');
  return {
    ...actual,
    LiveConnection: jest.fn().mockImplementation((_makeSocket, handlers) => {
      lastHandlers = handlers;
      mockLiveConnectionInstance = {
        open: jest.fn(),
        close: jest.fn(),
        resume: jest.fn(),
        getStatus: jest.fn().mockReturnValue('off'),
      };
      return mockLiveConnectionInstance;
    }),
  };
});

import SocketProvider, { useConnectionStatus } from './socket';

// Consumer component to test useConnectionStatus() context hook
const StatusConsumer = () => {
  const status = useConnectionStatus();
  return <Text testID="connection-status">{status}</Text>;
};

let appStateListener: ((state: AppStateStatus) => void) | undefined;

beforeAll(() => {
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((event: string, listener: any) => {
      if (event === 'change') {
        appStateListener = listener;
      }
      return { remove: jest.fn() } as any;
    });
});

describe('SocketProvider and useConnectionStatus', () => {
  let queryClient: QueryClient;
  let invalidateQueriesSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockUser = { id: 'courier-1', status: UserStatus.Online };
    await AsyncStorage.setItem('token', 'courier-jwt-token');
    await AsyncStorage.setItem('SOCKET_BASE_URL', 'http://localhost:3000');

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: Infinity },
      },
    });
    invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Clause 2 & 4: TanStack Query invalidation wiring', () => {
    it('refetches offers on NEW_DELIVERY_OFFER event (onOffer)', async () => {
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <SocketProvider>
              <StatusConsumer />
            </SocketProvider>
          </QueryClientProvider>,
        );
      });

      invalidateQueriesSpy.mockClear();

      // Trigger the onOffer handler wired by SocketProvider
      act(() => {
        lastHandlers.onOffer();
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.newOrders],
      });

      act(() => {
        tree.unmount();
      });
    });

    it('refetches offers and in progress jobs on every connect/reconnect (onConnected)', async () => {
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <SocketProvider>
              <StatusConsumer />
            </SocketProvider>
          </QueryClientProvider>,
        );
      });

      invalidateQueriesSpy.mockClear();

      // Trigger the onConnected handler wired by SocketProvider
      act(() => {
        lastHandlers.onConnected();
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.newOrders],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });

      act(() => {
        tree.unmount();
      });
    });

    it('refetches offers, in progress jobs and history on DELIVERY_STATUS_UPDATED (onDeliveryStatusUpdated)', async () => {
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <SocketProvider>
              <StatusConsumer />
            </SocketProvider>
          </QueryClientProvider>,
        );
      });

      invalidateQueriesSpy.mockClear();

      // Trigger the onDeliveryStatusUpdated handler wired by SocketProvider
      act(() => {
        lastHandlers.onDeliveryStatusUpdated();
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(3);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.newOrders],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.orderHistory],
      });

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('Clause 1: ConnectionStatus context and useConnectionStatus', () => {
    it('provides status from context and updates when onStatus fires', async () => {
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <SocketProvider>
              <StatusConsumer />
            </SocketProvider>
          </QueryClientProvider>,
        );
      });

      const getRenderedStatus = () =>
        tree.root.findByProps({ testID: 'connection-status' }).props.children;

      // Initial default status is 'off'
      expect(getRenderedStatus()).toBe('off');

      // Status changes to 'connecting'
      act(() => {
        lastHandlers.onStatus('connecting');
      });
      expect(getRenderedStatus()).toBe('connecting');

      // Status changes to 'connected'
      act(() => {
        lastHandlers.onStatus('connected');
      });
      expect(getRenderedStatus()).toBe('connected');

      // Status changes to 'disconnected'
      act(() => {
        lastHandlers.onStatus('disconnected');
      });
      expect(getRenderedStatus()).toBe('disconnected');

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('Clause 2: Foreground resume on active AppState', () => {
    it('calls connection.resume() when AppState changes to active', async () => {
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <SocketProvider>
              <StatusConsumer />
            </SocketProvider>
          </QueryClientProvider>,
        );
      });

      expect(mockLiveConnectionInstance.resume).not.toHaveBeenCalled();
      expect(appStateListener).toBeDefined();

      // Simulate app coming back to active foreground
      act(() => {
        appStateListener?.('active');
      });

      expect(mockLiveConnectionInstance.resume).toHaveBeenCalledTimes(1);

      // Simulate app going to background: should not trigger resume
      act(() => {
        appStateListener?.('background');
      });

      expect(mockLiveConnectionInstance.resume).toHaveBeenCalledTimes(1);

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('Clause 3: Connection lifecycle (open on online, close on offline/logout/unmount)', () => {
    it('opens connection with token and URL from AsyncStorage when rider is online', async () => {
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <SocketProvider>
              <StatusConsumer />
            </SocketProvider>
          </QueryClientProvider>,
        );
      });

      expect(mockLiveConnectionInstance.open).toHaveBeenCalledWith(
        'http://localhost:3000',
        'courier-jwt-token',
      );

      act(() => {
        tree.unmount();
      });
    });

    it('closes connection when rider is offline with no active jobs', async () => {
      mockUser = { id: 'courier-1', status: UserStatus.Offline };

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <SocketProvider>
              <StatusConsumer />
            </SocketProvider>
          </QueryClientProvider>,
        );
      });

      expect(mockLiveConnectionInstance.close).toHaveBeenCalled();
      expect(mockLiveConnectionInstance.open).not.toHaveBeenCalled();

      act(() => {
        tree.unmount();
      });
    });

    it('closes connection when rider logs out (user is null)', async () => {
      mockUser = null;

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <SocketProvider>
              <StatusConsumer />
            </SocketProvider>
          </QueryClientProvider>,
        );
      });

      expect(mockLiveConnectionInstance.close).toHaveBeenCalled();
      expect(mockLiveConnectionInstance.open).not.toHaveBeenCalled();

      act(() => {
        tree.unmount();
      });
    });

    it('closes connection when SocketProvider unmounts', async () => {
      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <SocketProvider>
              <StatusConsumer />
            </SocketProvider>
          </QueryClientProvider>,
        );
      });

      mockLiveConnectionInstance.close.mockClear();

      act(() => {
        tree.unmount();
      });

      expect(mockLiveConnectionInstance.close).toHaveBeenCalledTimes(1);
    });
  });
});
