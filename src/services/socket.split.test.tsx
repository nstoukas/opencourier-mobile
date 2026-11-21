import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Socket } from 'socket.io-client';
import '@app/localization/i18n';
import { QueryKeys } from '@app/utilities/queryKeys';
import { SPLIT_REQUEST_DECIDED_EVENT } from './liveConnection';
import { clearSplitNotices } from './splitNotice/splitNotice';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// A stand-in for the socket: it remembers listeners and lets the test fire an event.
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

// Spec 0047 (AC-7, cross check 12): dispatch's answer arrives on the live connection.
// The job list carries the answer, so the app reads the jobs again, and (row 11 review) tells the rider
// with a notification and the phone's sound, as a removal answer is told.
describe('SocketProvider SPLIT_REQUEST_DECIDED (spec 0047)', () => {
  let queryClient: QueryClient;
  let tree: renderer.ReactTestRenderer;

  beforeEach(async () => {
    jest.clearAllMocks();
    // What an earlier test showed is forgotten, so each answer here is a new one.
    clearSplitNotices();
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

  it('reads the job list again when dispatch answers a split request', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      mockLatestSocket!.emit(SPLIT_REQUEST_DECIDED_EVENT, {
        deliveryId: 'del-1',
        outcome: 'REFUSED',
        adminNote: 'It fits',
        legNumber: null,
        legCount: null,
        boxSize: null,
      });
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
  });

  it("tells the rider dispatch's answer with a notification (a refusal, with dispatch's sentence)", async () => {
    await act(async () => {
      mockLatestSocket!.emit(SPLIT_REQUEST_DECIDED_EVENT, {
        deliveryId: 'del-1',
        outcome: 'REFUSED',
        adminNote: 'It fits',
        legNumber: null,
        legCount: null,
        boxSize: null,
      });
    });

    expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'split-del-1',
        title: 'Dispatch says it fits',
        body: 'Dispatch: It fits',
      }),
    );
  });

  it('tells the rider of a confirm, naming the size they keep', async () => {
    await act(async () => {
      mockLatestSocket!.emit(SPLIT_REQUEST_DECIDED_EVENT, {
        deliveryId: 'del-2',
        outcome: 'CONFIRMED',
        adminNote: null,
        legNumber: 1,
        legCount: 2,
        boxSize: 'LARGE',
      });
    });

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'split-del-2',
        title: 'Dispatch split the order',
        body: 'Split by dispatch: you take the Large box',
      }),
    );
  });

  it('the same answer sent twice on the live connection is told once, the jobs read each time', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const answer = {
      deliveryId: 'del-3',
      outcome: 'REFUSED',
      adminNote: null,
      legNumber: null,
      legCount: null,
      boxSize: null,
    };

    await act(async () => {
      mockLatestSocket!.emit(SPLIT_REQUEST_DECIDED_EVENT, answer);
    });
    await act(async () => {
      mockLatestSocket!.emit(SPLIT_REQUEST_DECIDED_EVENT, answer);
    });

    expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    expect(
      invalidate.mock.calls.filter(
        ([arg]) => (arg as any).queryKey[0] === QueryKeys.inProgressOrders,
      ),
    ).toHaveLength(2);
  });

  it('a notice that cannot be posted does not stop the jobs being read again, or crash the app', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    (notifee.displayNotification as jest.Mock).mockRejectedValueOnce(
      new Error('Notifee failed to post'),
    );

    await act(async () => {
      mockLatestSocket!.emit(SPLIT_REQUEST_DECIDED_EVENT, {
        deliveryId: 'del-4',
        outcome: 'REFUSED',
        adminNote: null,
        legNumber: null,
        legCount: null,
        boxSize: null,
      });
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
    logSpy.mockRestore();
  });

  it('does not read the job list for an unrelated event', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      mockLatestSocket!.emit('SOMETHING_ELSE', { deliveryId: 'del-1' });
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});
