import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AppState, AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Socket } from 'socket.io-client';
import '@app/localization/i18n';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  CHAT_MESSAGE_EVENT,
  CHAT_READ_BY_DISPATCH_EVENT,
} from './liveConnection';
import { noticeChatMessage } from './chat/chatNotice';
import SocketProvider from './socket';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('./chat/chatNotice', () => ({
  noticeChatMessage: jest.fn(() => Promise.resolve()),
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
  user: { id: 'courier-chat-test', status: 'ONLINE' },
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

let appStateListener: ((state: AppStateStatus) => void) | undefined;

describe('SocketProvider chat events wiring (spec 0034, AC-8, AC-10, AC-11)', () => {
  let queryClient: QueryClient;
  let invalidateSpy: jest.SpyInstance;
  let tree: renderer.ReactTestRenderer;

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

    expect(mockLatestSocket).not.toBeNull();
    invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    act(() => {
      tree.unmount();
    });
    queryClient.clear();
  });

  it('refetches chatMessages on CHAT_MESSAGE socket event and draws notice when from dispatch (Major 2, AC-11)', async () => {
    await act(async () => {
      mockLatestSocket!.emit(CHAT_MESSAGE_EVENT, {
        message: { senderKind: 'DISPATCH', body: 'New message from dispatch' },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.chatMessages],
    });
    expect(noticeChatMessage).toHaveBeenCalledTimes(1);
  });

  it('refetches chatMessages on CHAT_MESSAGE socket event but draws NO notice when rider own message (Major 2, AC-11)', async () => {
    await act(async () => {
      mockLatestSocket!.emit(CHAT_MESSAGE_EVENT, {
        message: { senderKind: 'COURIER', body: 'My own message' },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.chatMessages],
    });
    expect(noticeChatMessage).not.toHaveBeenCalled();
  });

  it('refetches chatMessages on CHAT_READ_BY_DISPATCH socket event', async () => {
    await act(async () => {
      mockLatestSocket!.emit(CHAT_READ_BY_DISPATCH_EVENT, {
        dispatchLastReadAt: '2026-11-17T14:00:00Z',
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.chatMessages],
    });
  });

  it('refetches chatMessages along with offers and held jobs on (re)connect', async () => {
    invalidateSpy.mockClear();

    await act(async () => {
      mockLatestSocket!.emit('connect');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.chatMessages],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.newOrders],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
  });

  it('coming back to the front refetches chat messages so the dot appears (Minor 1, AC-10)', async () => {
    invalidateSpy.mockClear();

    await act(async () => {
      appStateListener?.('active');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.chatMessages],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.user],
    });
  });
});
