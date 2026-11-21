import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Socket } from 'socket.io-client';
import { Order, UserStatus } from '@app/types/types';
import { socketUrl } from '@app/utilities/config';
import { client } from '@app/services/Client';
import { endExpiredSession, saveSession } from '@app/services/session';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// A fake socket handed to the real LiveConnection through its socket factory.
class FakeSocket {
  connected = false;
  active = true;
  events = new Map<string, Array<(...args: any[]) => void>>();
  connectCalls = 0;
  disconnectCalls = 0;

  constructor(public readonly url: string, public readonly token: string) {}

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

  connect() {
    this.connectCalls++;
  }

  disconnect() {
    this.disconnectCalls++;
  }

  removeAllListeners() {
    this.events.clear();
  }
}

let createdSockets: FakeSocket[] = [];

const mockCreateCourierSocket = jest.fn(
  (url: string, token: string): Socket => {
    const socket = new FakeSocket(url, token);
    createdSockets.push(socket);
    return socket as unknown as Socket;
  },
);

// LiveConnection itself is real; only the factory that would open a network socket is replaced.
jest.mock('./liveConnection', () => {
  const actual = jest.requireActual('./liveConnection');
  return {
    ...actual,
    createCourierSocket: (url: string, token: string) =>
      mockCreateCourierSocket(url, token),
  };
});

// The session module is real (saving tokens, the counter), except ending the session, which is watched.
jest.mock('@app/services/session', () => {
  const actual = jest.requireActual('@app/services/session');
  return {
    ...actual,
    endExpiredSession: jest.fn().mockResolvedValue(undefined),
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

const mockInProgressOrdersData: Order[] = [];

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

const mockEndExpiredSession = endExpiredSession as jest.Mock;

const StatusConsumer = () => {
  const status = useConnectionStatus();
  return <Text testID="connection-status">{status}</Text>;
};

const DEACTIVATED_SENTENCE =
  'Your account was deactivated by the co-op. If you think this is a mistake, call the co-op on +30 24210 12345.';

// What socket.io hands a `connect_error` listener when the server refuses the connection.
const refusal = (message: string, data?: unknown) =>
  Object.assign(new Error(message), data === undefined ? {} : { data });

// Row 108 review, written from its rulings (spec 0051, AC-8, AC-9).
describe('SocketProvider: the rider account upkeep review fixes (spec 0051, row 108 review)', () => {
  let queryClient: QueryClient;
  let tree: renderer.ReactTestRenderer;
  // Stands in for the HTTP client saveSession writes the new token onto.
  const http: any = { defaults: { headers: { common: {} } } };

  const mount = async () => {
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={queryClient}>
          <SocketProvider>
            <StatusConsumer />
          </SocketProvider>
        </QueryClientProvider>,
      );
    });
  };
  const shownStatus = () =>
    tree.root.findByProps({ testID: 'connection-status' }).props.children;
  const latest = () => createdSockets[createdSockets.length - 1];

  beforeEach(async () => {
    jest.clearAllMocks();
    createdSockets = [];
    mockUser = { id: 'courier-1', status: UserStatus.Online };
    await AsyncStorage.clear();
    await AsyncStorage.setItem('token', 'token-before-change');
    await AsyncStorage.setItem('refreshToken', 'refresh-before-change');
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: Infinity },
      },
    });
  });

  afterEach(() => {
    act(() => {
      tree.unmount();
    });
    queryClient.clear();
  });

  // Ruling: "The live connection stays closed after a password change". The server closes every socket of
  // the rider when the password changes, this phone's too; the app reopens its own once the new tokens are
  // saved, without waiting to come back to the foreground.
  describe('new tokens saved (the rider changed their password)', () => {
    it('opens a new socket with the new token, and closes the one opened with the old token', async () => {
      await mount();
      expect(createdSockets).toHaveLength(1);
      expect(createdSockets[0].token).toBe('token-before-change');

      await act(async () => {
        await saveSession('token-after-change', 'refresh-after-change', http);
      });

      expect(createdSockets).toHaveLength(2);
      expect(latest().url).toBe(socketUrl);
      expect(latest().token).toBe('token-after-change');
      // The old socket is closed for good, not left to retry with a token the server refuses.
      expect(createdSockets[0].disconnectCalls).toBe(1);
      expect(latest().disconnectCalls).toBe(0);
    });

    it('reopens after the server already closed the old socket, with the app still in the foreground', async () => {
      await mount();
      act(() => {
        createdSockets[0].emit('connect');
      });
      expect(shownStatus()).toBe('connected');
      // The server ends this rider's sockets as part of the change.
      act(() => {
        createdSockets[0].emit('disconnect', 'io server disconnect');
      });
      expect(shownStatus()).toBe('disconnected');

      await act(async () => {
        await saveSession('token-after-change', 'refresh-after-change', http);
      });

      expect(createdSockets).toHaveLength(2);
      expect(latest().token).toBe('token-after-change');
      act(() => {
        latest().emit('connect');
      });
      expect(shownStatus()).toBe('connected');
    });

    it('each later save reopens with the token of that save', async () => {
      await mount();

      await act(async () => {
        await saveSession('token-2', 'refresh-2', http);
      });
      await act(async () => {
        await saveSession('token-3', 'refresh-3', http);
      });

      expect(createdSockets.map(socket => socket.token)).toEqual([
        'token-before-change',
        'token-2',
        'token-3',
      ]);
      expect(createdSockets[1].disconnectCalls).toBe(1);
    });

    it('a rider who is Offline with no job gets no socket from a save', async () => {
      mockUser = { id: 'courier-1', status: UserStatus.Offline };
      await mount();
      expect(createdSockets).toHaveLength(0);

      await act(async () => {
        await saveSession('token-after-change', 'refresh-after-change', http);
      });

      expect(createdSockets).toHaveLength(0);
    });

    it('a save after the provider is gone opens nothing', async () => {
      await mount();
      act(() => {
        tree.unmount();
      });

      await act(async () => {
        await saveSession('token-after-change', 'refresh-after-change', http);
      });

      expect(createdSockets).toHaveLength(1);
      // afterEach unmounts again; give it something mounted.
      await mount();
    });
  });

  // Ruling: "A socket refused for a deactivated account shows no notice". Fixed where the connection error
  // is read, with the same notice as a refused renewal (AC-9).
  describe('a connection the server refuses with a code', () => {
    it('ACCOUNT_DEACTIVATED: ends the session with the deactivated notice and the server sentence', async () => {
      await mount();
      latest().active = false;

      act(() => {
        latest().emit(
          'connect_error',
          refusal(DEACTIVATED_SENTENCE, { code: 'ACCOUNT_DEACTIVATED' }),
        );
      });

      expect(mockEndExpiredSession).toHaveBeenCalledTimes(1);
      expect(mockEndExpiredSession).toHaveBeenCalledWith(client, {
        kind: 'deactivated',
        message: DEACTIVATED_SENTENCE,
      });
    });

    it('CREDENTIALS_CHANGED: ends the session with the credentials notice', async () => {
      await mount();
      latest().active = false;

      act(() => {
        latest().emit(
          'connect_error',
          refusal('Your password or login email was changed. Log in again.', {
            code: 'CREDENTIALS_CHANGED',
          }),
        );
      });

      expect(mockEndExpiredSession).toHaveBeenCalledTimes(1);
      expect(mockEndExpiredSession).toHaveBeenCalledWith(client, {
        kind: 'credentials',
        message: null,
      });
    });

    it.each([
      ['an expired token', refusal('Unauthorized', { code: 'JWT_EXPIRED' })],
      ['any other code', refusal('Unauthorized', { code: 'UNAUTHORIZED' })],
      ['a refusal with no code', refusal('Unauthorized')],
      ['a dropped network', refusal('xhr poll error')],
    ])('%s does not end the session', async (_name, error) => {
      await mount();
      latest().active = false;

      act(() => {
        latest().emit('connect_error', error);
      });

      expect(mockEndExpiredSession).not.toHaveBeenCalled();
      expect(shownStatus()).toBe('refused');
    });

    it('ending the session that fails does not break the app', async () => {
      mockEndExpiredSession.mockRejectedValueOnce(new Error('storage failed'));
      await mount();

      await act(async () => {
        latest().emit(
          'connect_error',
          refusal(DEACTIVATED_SENTENCE, { code: 'ACCOUNT_DEACTIVATED' }),
        );
      });

      expect(mockEndExpiredSession).toHaveBeenCalledTimes(1);
      expect(shownStatus()).toBe('disconnected');
    });
  });
});
