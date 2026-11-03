import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import { Socket } from 'socket.io-client';
import '@app/localization/i18n';
import { UserStatus } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import { JOB_READY_UPDATED_EVENT } from './liveConnection';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// A small stand in for the Socket.IO socket: records listeners, emits on demand.
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

// Only the socket factory is replaced; the real LiveConnection wires the events.
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

// Spec 0023 (AC-6): the live JOB_READY_UPDATED event posts the notice and
// refetches only the held jobs.
describe('SocketProvider JOB_READY_UPDATED (spec 0023, AC-6)', () => {
  const originalOS = Platform.OS;
  let queryClient: QueryClient;
  let invalidateSpy: jest.SpyInstance;
  let tree: renderer.ReactTestRenderer;

  beforeEach(async () => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    mockLatestSocket = null;
    await AsyncStorage.setItem('token', 'courier-jwt-token');
    await AsyncStorage.setItem('SOCKET_BASE_URL', 'http://localhost:3000');
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
    expect(mockLatestSocket).not.toBeNull();
    invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    act(() => {
      tree.unmount();
    });
    queryClient.clear();
    Platform.OS = originalOS;
  });

  const emit = async (message: unknown) => {
    await act(async () => {
      mockLatestSocket!.emit(JOB_READY_UPDATED_EVENT, message);
    });
  };

  it('the mocked rider is Online, so the live connection opens', () => {
    expect(UserStatus.Online).toBe('ONLINE');
    expect(mockLatestSocket).not.toBeNull();
  });

  it('posts the ready notice from a delay message and invalidates only the in progress jobs', async () => {
    const readyAt = new Date(Date.now() + 12 * 60 * 1000 - 1000).toISOString();
    await emit({
      deliveryId: 'del-live-1',
      restaurantName: 'R73 Kitchen',
      readyAt,
      foodReadyAt: null,
      delayMinutes: 10,
    });

    expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ready-del-live-1',
        body: 'R73 Kitchen: +10 min, ready in ~12 min',
        android: expect.objectContaining({ channelId: 'job-ready' }),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
  });

  it('posts "food ready" for a food ready message', async () => {
    await emit({
      deliveryId: 'del-live-2',
      restaurantName: 'R73 Kitchen',
      readyAt: '2026-11-03T12:10:00.000Z',
      foodReadyAt: '2026-11-03T12:01:00.000Z',
      delayMinutes: null,
    });
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ready-del-live-2',
        body: 'R73 Kitchen: food ready',
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
  });

  it('posts nothing and refetches nothing for a malformed message', async () => {
    await emit({ restaurantName: 'R73 Kitchen', delayMinutes: 10 });
    await emit(null);
    await emit('del-live-3');
    expect(notifee.displayNotification).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
