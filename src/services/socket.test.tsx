import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { AppState, AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Socket } from 'socket.io-client';
import { Order, UserStatus } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { QueryKeys } from '@app/utilities/queryKeys';
import { DELIVERY_STATUS_UPDATED_EVENT, OFFER_EVENT } from './liveConnection';

// Mock AsyncStorage using the official jest mock
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Minimal EventEmitter fake socket to test provider lifecycle through makeSocket seam
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

  listenerCount(event: string): number {
    return this.events.get(event)?.length ?? 0;
  }
}

let latestSocket: FakeSocket | null = null;
let createdSockets: FakeSocket[] = [];

// Track makeSocket calls; LiveConnection is NOT mocked whole, only the socket factory seam is intercepted.
const mockCreateCourierSocket = jest.fn(
  (url: string, token: string): Socket => {
    const s = new FakeSocket(url, token);
    latestSocket = s;
    createdSockets.push(s);
    return s as unknown as Socket;
  },
);

jest.mock('./liveConnection', () => {
  const actual = jest.requireActual('./liveConnection');
  return {
    ...actual,
    createCourierSocket: (url: string, token: string) =>
      mockCreateCourierSocket(url, token),
  };
});

let mockUser: { id: string; status: UserStatus } | null = {
  id: 'courier-1',
  status: UserStatus.Online,
};

jest.mock('@app/hooks/useUser', () => () => ({
  user: mockUser,
  isLoading: false,
  refetchUser: jest.fn(),
}));

let mockInProgressOrdersData: Order[] = [];

jest.mock('@app/services/service', () => ({
  services: {
    orderService: {
      getInProgressOrders: jest
        .fn()
        .mockImplementation(() => Promise.resolve(mockInProgressOrdersData)),
    },
  },
}));

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

  const renderTree = (qc: QueryClient) => (
    <QueryClientProvider client={qc}>
      <SocketProvider>
        <StatusConsumer />
      </SocketProvider>
    </QueryClientProvider>
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    latestSocket = null;
    createdSockets = [];
    mockUser = { id: 'courier-1', status: UserStatus.Online };
    mockInProgressOrdersData = [];
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

  describe('Clause 2 & 4: TanStack Query invalidation wiring via real LiveConnection', () => {
    it('refetches offers on NEW_DELIVERY_OFFER event', async () => {
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      expect(latestSocket).not.toBeNull();
      invalidateQueriesSpy.mockClear();

      // Emit offer event from real socket
      act(() => {
        latestSocket!.emit(OFFER_EVENT, { deliveryId: 'order-123' });
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.newOrders],
      });

      act(() => {
        tree.unmount();
      });
    });

    it('refetches offers and in progress jobs on every connect/reconnect', async () => {
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      expect(latestSocket).not.toBeNull();
      invalidateQueriesSpy.mockClear();

      // Emit connect event
      act(() => {
        latestSocket!.emit('connect');
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

    it('refetches offers, in progress jobs and history on DELIVERY_STATUS_UPDATED', async () => {
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      expect(latestSocket).not.toBeNull();
      invalidateQueriesSpy.mockClear();

      // Emit delivery status updated event
      act(() => {
        latestSocket!.emit(DELIVERY_STATUS_UPDATED_EVENT, {
          deliveryId: 'order-123',
          status: 'PICKED_UP',
        });
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

  describe('Clause 1: ConnectionStatus context and useConnectionStatus via real socket events', () => {
    it('provides status from context and updates when real socket events fire', async () => {
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      const getRenderedStatus = () =>
        tree.root.findByProps({ testID: 'connection-status' }).props.children;

      // When open() is called on an unconnected socket, status starts as 'connecting'
      expect(getRenderedStatus()).toBe('connecting');

      // Socket connects -> status is 'connected'
      act(() => {
        latestSocket!.emit('connect');
      });
      expect(getRenderedStatus()).toBe('connected');

      // Socket disconnects (network drop) -> status is 'disconnected'
      act(() => {
        latestSocket!.emit('disconnect');
      });
      expect(getRenderedStatus()).toBe('disconnected');

      // Server refuses login (active false) -> status is 'refused' (Minor 1)
      act(() => {
        latestSocket!.active = false;
        latestSocket!.emit(
          'connect_error',
          new Error('Authentication rejected'),
        );
      });
      expect(getRenderedStatus()).toBe('refused');

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('Clause 2: Foreground resume on active AppState', () => {
    it('calls socket.connect() when AppState changes to active and socket is down', async () => {
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      expect(latestSocket).not.toBeNull();
      expect(appStateListener).toBeDefined();

      // Disconnect socket
      act(() => {
        latestSocket!.connected = false;
        latestSocket!.emit('disconnect');
      });
      expect(latestSocket!.connectCalls).toBe(0);

      // App comes back to active foreground
      act(() => {
        appStateListener?.('active');
      });

      expect(latestSocket!.connectCalls).toBe(1);

      // Background event should not call connect
      act(() => {
        appStateListener?.('background');
      });

      expect(latestSocket!.connectCalls).toBe(1);

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('Clause 3 & Minor 2: Provider level lifecycle rules with real LiveConnection', () => {
    it('opens connection with token and URL from AsyncStorage when rider is online', async () => {
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      expect(mockCreateCourierSocket).toHaveBeenCalledWith(
        'http://localhost:3000',
        'courier-jwt-token',
      );
      expect(createdSockets.length).toBe(1);

      act(() => {
        tree.unmount();
      });
    });

    it('closes connection when rider is offline with no active jobs', async () => {
      mockUser = { id: 'courier-1', status: UserStatus.Offline };

      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      expect(mockCreateCourierSocket).not.toHaveBeenCalled();
      expect(createdSockets.length).toBe(0);
      expect(
        tree.root.findByProps({ testID: 'connection-status' }).props.children,
      ).toBe('off');

      act(() => {
        tree.unmount();
      });
    });

    it('going Offline while carrying a job keeps the connection open and it closes once the job ends (decision 57.1)', async () => {
      // Rider starts Online carrying 1 active delivery
      const activeJob: Order = {
        id: 'delivery-job-42',
        status: OrderStatus.picked_up,
      } as Order;
      mockInProgressOrdersData = [activeJob];
      mockUser = { id: 'courier-1', status: UserStatus.Online };

      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      expect(createdSockets.length).toBe(1);
      const socket = latestSocket!;
      act(() => {
        socket.emit('connect');
      });
      expect(
        tree.root.findByProps({ testID: 'connection-status' }).props.children,
      ).toBe('connected');

      // Rider goes Offline while still carrying the delivery (e.g. server switches Last Call to Offline)
      mockUser = { id: 'courier-1', status: UserStatus.Offline };
      await act(async () => {
        tree.update(renderTree(queryClient));
      });

      // Socket must STAY open: decision 57.1 ensures the rider can still receive job cancellations
      expect(socket.disconnectCalls).toBe(0);
      expect(socket.removeAllListenersCalls).toBe(0);
      expect(
        tree.root.findByProps({ testID: 'connection-status' }).props.children,
      ).toBe('connected');

      // Now the active job completes or is cancelled (list becomes empty)
      mockInProgressOrdersData = [];
      await act(async () => {
        queryClient.setQueryData([QueryKeys.inProgressOrders], []);
        tree.update(renderTree(queryClient));
      });

      // With 0 jobs remaining and user Offline, socket must now cleanly close
      expect(socket.disconnectCalls).toBe(1);
      expect(socket.removeAllListenersCalls).toBe(1);
      expect(
        tree.root.findByProps({ testID: 'connection-status' }).props.children,
      ).toBe('off');

      act(() => {
        tree.unmount();
      });
    });

    it('logout after the connection opened closes it', async () => {
      // Rider is Online and connection opens
      mockUser = { id: 'courier-1', status: UserStatus.Online };

      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      expect(createdSockets.length).toBe(1);
      const socket = latestSocket!;
      act(() => {
        socket.emit('connect');
      });
      expect(
        tree.root.findByProps({ testID: 'connection-status' }).props.children,
      ).toBe('connected');

      // Rider logs out: user becomes null
      mockUser = null;
      await act(async () => {
        tree.update(renderTree(queryClient));
      });

      // Socket must be cleanly closed and disconnected
      expect(socket.disconnectCalls).toBe(1);
      expect(socket.removeAllListenersCalls).toBe(1);
      expect(
        tree.root.findByProps({ testID: 'connection-status' }).props.children,
      ).toBe('off');

      act(() => {
        tree.unmount();
      });
    });

    it('switching user (new token) replaces the socket and never leaves two NEW_DELIVERY_OFFER handlers', async () => {
      // Courier 1 logs in
      await AsyncStorage.setItem('token', 'token-courier-1');
      mockUser = { id: 'courier-1', status: UserStatus.Online };

      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      expect(createdSockets.length).toBe(1);
      const firstSocket = latestSocket!;
      expect(firstSocket.token).toBe('token-courier-1');
      expect(firstSocket.listenerCount(OFFER_EVENT)).toBe(1);

      // Courier 1 logs out and Courier 2 logs in with a new token
      await AsyncStorage.setItem('token', 'token-courier-2');
      mockUser = { id: 'courier-2', status: UserStatus.Online };

      await act(async () => {
        tree.update(renderTree(queryClient));
      });

      // The old socket must be completely closed with listeners removed
      expect(firstSocket.disconnectCalls).toBe(1);
      expect(firstSocket.removeAllListenersCalls).toBe(1);
      expect(firstSocket.listenerCount(OFFER_EVENT)).toBe(0);

      // A fresh socket for Courier 2 must be created with exactly 1 handler
      expect(createdSockets.length).toBe(2);
      const secondSocket = latestSocket!;
      expect(secondSocket).not.toBe(firstSocket);
      expect(secondSocket.token).toBe('token-courier-2');
      expect(secondSocket.listenerCount(OFFER_EVENT)).toBe(1);

      // Emitting on the old socket must NOT trigger query invalidations
      invalidateQueriesSpy.mockClear();
      act(() => {
        firstSocket.emit(OFFER_EVENT, { deliveryId: 'stale-offer' });
      });
      expect(invalidateQueriesSpy).not.toHaveBeenCalled();

      // Emitting on the new socket triggers query invalidation exactly once
      act(() => {
        secondSocket.emit(OFFER_EVENT, { deliveryId: 'fresh-offer' });
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.newOrders],
      });

      act(() => {
        tree.unmount();
      });
    });

    it("resume() on foreground after 'refused' calls connect again", async () => {
      mockUser = { id: 'courier-1', status: UserStatus.Online };

      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      expect(latestSocket).not.toBeNull();
      const socket = latestSocket!;

      // Server rejects the handshake (socket.active becomes false)
      act(() => {
        socket.active = false;
        socket.connected = false;
        socket.emit('connect_error', new Error('JWT token invalid or expired'));
      });

      expect(
        tree.root.findByProps({ testID: 'connection-status' }).props.children,
      ).toBe('refused');
      expect(socket.connectCalls).toBe(0);

      // App comes back to active foreground
      act(() => {
        appStateListener?.('active');
      });

      // LiveConnection.resume() should call socket.connect() and transition to connecting
      expect(socket.connectCalls).toBe(1);
      expect(
        tree.root.findByProps({ testID: 'connection-status' }).props.children,
      ).toBe('connecting');

      act(() => {
        tree.unmount();
      });
    });

    it('the cancelled flag stops a late AsyncStorage read from reopening after logout', async () => {
      // Setup a deferred AsyncStorage read
      let resolveToken: (value: string | null) => void = () => {};
      const tokenPromise = new Promise<string | null>(resolve => {
        resolveToken = resolve;
      });

      jest.spyOn(AsyncStorage, 'getItem').mockImplementation((key: string) => {
        if (key === 'token') {
          return tokenPromise;
        }
        return Promise.resolve('http://localhost:3000');
      });

      mockUser = { id: 'courier-1', status: UserStatus.Online };

      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      // While token read is still in flight, user logs out
      mockUser = null;
      await act(async () => {
        tree.update(renderTree(queryClient));
      });

      // Now the late token read finally resolves
      await act(async () => {
        resolveToken('late-token');
      });

      // Because the effect cleanup ran on logout, cancelled was set to true, so socket was never opened
      expect(createdSockets.length).toBe(0);
      expect(
        tree.root.findByProps({ testID: 'connection-status' }).props.children,
      ).toBe('off');

      act(() => {
        tree.unmount();
      });
    });

    it('closes connection when SocketProvider unmounts', async () => {
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(renderTree(queryClient));
      });

      expect(createdSockets.length).toBe(1);
      const socket = latestSocket!;

      act(() => {
        tree.unmount();
      });

      expect(socket.disconnectCalls).toBe(1);
      expect(socket.removeAllListenersCalls).toBe(1);
    });
  });
});
