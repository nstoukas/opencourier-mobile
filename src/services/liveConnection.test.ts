import { io } from 'socket.io-client';
import { UserStatus } from '@app/types/types';
import {
  COURIER_NAMESPACE,
  DELIVERY_STATUS_UPDATED_EVENT,
  LiveConnection,
  LiveConnectionHandlers,
  OFFER_EVENT,
  courierSocketUrl,
  createCourierSocket,
  shouldBeConnected,
} from './liveConnection';

// Mock socket.io-client so createCourierSocket can be tested without network calls.
jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

// Minimal EventEmitter-like fake socket for testing LiveConnection in isolation.
class FakeSocket {
  connected = false;
  events = new Map<string, Array<(...args: any[]) => void>>();
  connectCalls = 0;
  disconnectCalls = 0;
  removeAllListenersCalls = 0;

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

describe('liveConnection', () => {
  describe('courierSocketUrl (Clause 2: socket joins /couriers namespace without doubling)', () => {
    it('appends /couriers to a bare instance URL', () => {
      expect(courierSocketUrl('http://localhost:3000')).toBe(
        `http://localhost:3000${COURIER_NAMESPACE}`,
      );
    });

    it('avoids doubled slash when URL has a trailing slash', () => {
      expect(courierSocketUrl('http://localhost:3000/')).toBe(
        `http://localhost:3000${COURIER_NAMESPACE}`,
      );
    });

    it('strips multiple trailing slashes before appending /couriers', () => {
      expect(courierSocketUrl('http://localhost:3000///')).toBe(
        `http://localhost:3000${COURIER_NAMESPACE}`,
      );
    });

    it('does not duplicate /couriers if URL already ends with /couriers', () => {
      expect(courierSocketUrl('http://localhost:3000/couriers')).toBe(
        'http://localhost:3000/couriers',
      );
    });

    it('does not duplicate /couriers if URL ends with /couriers/', () => {
      expect(courierSocketUrl('http://localhost:3000/couriers/')).toBe(
        'http://localhost:3000/couriers',
      );
    });
  });

  describe('createCourierSocket', () => {
    it('opens socket with courierSocketUrl, websocket transport and bearer token', () => {
      createCourierSocket('http://localhost:3000', 'jwt-token-xyz');

      expect(io).toHaveBeenCalledWith('http://localhost:3000/couriers', {
        transports: ['websocket'],
        auth: { authorization: 'Bearer jwt-token-xyz' },
      });
    });
  });

  describe('shouldBeConnected (Clause 3: close on logout / offline, keep on active job)', () => {
    it('returns false when logged out (status is undefined) with 0 jobs', () => {
      expect(shouldBeConnected(undefined, 0)).toBe(false);
    });

    it('returns false when logged out (status is undefined) even if active jobs remain', () => {
      expect(shouldBeConnected(undefined, 1)).toBe(false);
    });

    it('returns false when Offline with 0 active jobs', () => {
      expect(shouldBeConnected(UserStatus.Offline, 0)).toBe(false);
    });

    it('returns true when Offline but still carrying an active job (decision 57.1: hear cancelation)', () => {
      // Decision 57.1: a rider moved to Offline after accepting must still hear that job get canceled
      expect(shouldBeConnected(UserStatus.Offline, 1)).toBe(true);
      expect(shouldBeConnected(UserStatus.Offline, 3)).toBe(true);
    });

    it('returns true when Online with 0 active jobs', () => {
      expect(shouldBeConnected(UserStatus.Online, 0)).toBe(true);
    });

    it('returns true when Online with active jobs', () => {
      expect(shouldBeConnected(UserStatus.Online, 2)).toBe(true);
    });

    it('returns true when Last call with 0 active jobs', () => {
      expect(shouldBeConnected(UserStatus.LastCall, 0)).toBe(true);
    });

    it('returns true when Last call with active jobs', () => {
      expect(shouldBeConnected(UserStatus.LastCall, 1)).toBe(true);
    });
  });

  describe('LiveConnection - Clause 1: Status follows real socket events', () => {
    let fakeSocket: FakeSocket;
    let handlers: { [K in keyof LiveConnectionHandlers]: jest.Mock };
    let liveConn: LiveConnection;

    beforeEach(() => {
      fakeSocket = new FakeSocket();
      handlers = {
        onStatus: jest.fn(),
        onOffer: jest.fn(),
        onDeliveryStatusUpdated: jest.fn(),
        onConnected: jest.fn(),
      };
      liveConn = new LiveConnection(
        () => fakeSocket as unknown as any,
        handlers,
      );
    });

    it('starts with status off before open is called', () => {
      expect(liveConn.getStatus()).toBe('off');
    });

    it('sets status to connecting when opening a socket that is not yet connected', () => {
      fakeSocket.connected = false;
      liveConn.open('http://localhost:3000', 'token-1');

      expect(liveConn.getStatus()).toBe('connecting');
      expect(handlers.onStatus).toHaveBeenCalledWith('connecting');
    });

    it('sets status to connected immediately when opening a socket that is already connected', () => {
      fakeSocket.connected = true;
      liveConn.open('http://localhost:3000', 'token-1');

      expect(liveConn.getStatus()).toBe('connected');
      expect(handlers.onStatus).toHaveBeenCalledWith('connected');
    });

    it('transitions to connected when socket emits connect', () => {
      liveConn.open('http://localhost:3000', 'token-1');
      handlers.onStatus.mockClear();

      fakeSocket.emit('connect');

      expect(liveConn.getStatus()).toBe('connected');
      expect(handlers.onStatus).toHaveBeenCalledWith('connected');
    });

    it('transitions to disconnected when socket emits disconnect', () => {
      liveConn.open('http://localhost:3000', 'token-1');
      fakeSocket.emit('connect');
      handlers.onStatus.mockClear();

      fakeSocket.emit('disconnect');

      expect(liveConn.getStatus()).toBe('disconnected');
      expect(handlers.onStatus).toHaveBeenCalledWith('disconnected');
    });

    it('transitions to disconnected when socket emits connect_error (failure case)', () => {
      liveConn.open('http://localhost:3000', 'token-1');
      handlers.onStatus.mockClear();

      fakeSocket.emit('connect_error', new Error('Authentication failed'));

      expect(liveConn.getStatus()).toBe('disconnected');
      expect(handlers.onStatus).toHaveBeenCalledWith('disconnected');
    });

    it('transitions to off when closed on purpose', () => {
      liveConn.open('http://localhost:3000', 'token-1');
      fakeSocket.emit('connect');
      handlers.onStatus.mockClear();

      liveConn.close();

      expect(liveConn.getStatus()).toBe('off');
      expect(handlers.onStatus).toHaveBeenCalledWith('off');
    });

    it('does not re-invoke onStatus if the status has not changed', () => {
      liveConn.open('http://localhost:3000', 'token-1');
      fakeSocket.emit('connect');
      handlers.onStatus.mockClear();

      // Emit connect again while already connected
      fakeSocket.emit('connect');

      expect(handlers.onStatus).not.toHaveBeenCalled();
    });
  });

  describe('LiveConnection - Clause 2: Reconnection refetch, offer refetch and foreground resume', () => {
    let fakeSocket: FakeSocket;
    let handlers: { [K in keyof LiveConnectionHandlers]: jest.Mock };
    let liveConn: LiveConnection;

    beforeEach(() => {
      fakeSocket = new FakeSocket();
      handlers = {
        onStatus: jest.fn(),
        onOffer: jest.fn(),
        onDeliveryStatusUpdated: jest.fn(),
        onConnected: jest.fn(),
      };
      liveConn = new LiveConnection(
        () => fakeSocket as unknown as any,
        handlers,
      );
      liveConn.open('http://localhost:3000', 'token-1');
    });

    it('triggers onConnected on every connect including reconnects after network drop', () => {
      // First connect
      fakeSocket.emit('connect');
      expect(handlers.onConnected).toHaveBeenCalledTimes(1);

      // Network drops
      fakeSocket.emit('disconnect');
      expect(liveConn.getStatus()).toBe('disconnected');

      // Network returns and socket reconnects
      fakeSocket.emit('connect');
      expect(handlers.onConnected).toHaveBeenCalledTimes(2);
    });

    it('triggers onOffer when NEW_DELIVERY_OFFER event arrives', () => {
      fakeSocket.emit(OFFER_EVENT, { id: 'order-123' });
      expect(handlers.onOffer).toHaveBeenCalledTimes(1);
    });

    it('resume() calls socket.connect() and sets status to connecting when socket is down', () => {
      // Simulate socket was connected then disconnected
      fakeSocket.emit('connect');
      fakeSocket.emit('disconnect');
      expect(liveConn.getStatus()).toBe('disconnected');

      fakeSocket.connected = false;
      handlers.onStatus.mockClear();

      liveConn.resume();

      expect(fakeSocket.connectCalls).toBe(1);
      expect(liveConn.getStatus()).toBe('connecting');
      expect(handlers.onStatus).toHaveBeenCalledWith('connecting');
    });

    it('resume() does NOT call socket.connect() when socket is already connected', () => {
      fakeSocket.connected = true;
      fakeSocket.emit('connect');
      handlers.onStatus.mockClear();

      liveConn.resume();

      expect(fakeSocket.connectCalls).toBe(0);
      expect(handlers.onStatus).not.toHaveBeenCalled();
    });

    it('resume() does nothing when socket is closed (null)', () => {
      liveConn.close();
      expect(() => liveConn.resume()).not.toThrow();
      expect(fakeSocket.connectCalls).toBe(0);
    });
  });

  describe('LiveConnection - Clause 3: Lifecycle, clean close, and single socket guarantee', () => {
    let fakeSocket: FakeSocket;
    let makeSocketMock: jest.Mock;
    let handlers: { [K in keyof LiveConnectionHandlers]: jest.Mock };
    let liveConn: LiveConnection;

    beforeEach(() => {
      fakeSocket = new FakeSocket();
      makeSocketMock = jest.fn(() => fakeSocket as unknown as any);
      handlers = {
        onStatus: jest.fn(),
        onOffer: jest.fn(),
        onDeliveryStatusUpdated: jest.fn(),
        onConnected: jest.fn(),
      };
      liveConn = new LiveConnection(makeSocketMock, handlers);
    });

    it('close() removes all listeners, disconnects socket, and sets status off', () => {
      liveConn.open('http://localhost:3000', 'token-1');
      liveConn.close();

      expect(fakeSocket.removeAllListenersCalls).toBe(1);
      expect(fakeSocket.disconnectCalls).toBe(1);
      expect(liveConn.getStatus()).toBe('off');
    });

    it('close() is safe to call twice without error or duplicate disconnect calls', () => {
      liveConn.open('http://localhost:3000', 'token-1');
      liveConn.close();

      expect(() => liveConn.close()).not.toThrow();
      expect(fakeSocket.removeAllListenersCalls).toBe(1);
      expect(fakeSocket.disconnectCalls).toBe(1);
      expect(liveConn.getStatus()).toBe('off');
    });

    it('open() with the same URL and token does not create a second socket', () => {
      liveConn.open('http://localhost:3000', 'token-1');
      expect(makeSocketMock).toHaveBeenCalledTimes(1);

      // Calling open again with identical url and token keeps existing socket
      liveConn.open('http://localhost:3000', 'token-1');
      expect(makeSocketMock).toHaveBeenCalledTimes(1);
    });

    it('open() with a new token disconnects old socket and opens a new one', () => {
      const firstSocket = fakeSocket;
      const secondSocket = new FakeSocket();
      makeSocketMock
        .mockReturnValueOnce(firstSocket)
        .mockReturnValueOnce(secondSocket);

      liveConn.open('http://localhost:3000', 'token-1');
      expect(makeSocketMock).toHaveBeenCalledTimes(1);

      // Open with new token (another login)
      liveConn.open('http://localhost:3000', 'token-2');

      // Old socket was cleaned up and disconnected
      expect(firstSocket.removeAllListenersCalls).toBe(1);
      expect(firstSocket.disconnectCalls).toBe(1);

      // New socket was created
      expect(makeSocketMock).toHaveBeenCalledTimes(2);
      expect(makeSocketMock).toHaveBeenLastCalledWith(
        'http://localhost:3000',
        'token-2',
      );
    });

    it('open() with a new URL disconnects old socket and opens a new one', () => {
      const firstSocket = fakeSocket;
      const secondSocket = new FakeSocket();
      makeSocketMock
        .mockReturnValueOnce(firstSocket)
        .mockReturnValueOnce(secondSocket);

      liveConn.open('http://localhost:3000', 'token-1');
      liveConn.open('http://localhost:4000', 'token-1');

      expect(firstSocket.removeAllListenersCalls).toBe(1);
      expect(firstSocket.disconnectCalls).toBe(1);
      expect(makeSocketMock).toHaveBeenCalledTimes(2);
      expect(makeSocketMock).toHaveBeenLastCalledWith(
        'http://localhost:4000',
        'token-1',
      );
    });
  });

  describe('LiveConnection - Clause 4: Delivery status change refetch', () => {
    it('triggers onDeliveryStatusUpdated when DELIVERY_STATUS_UPDATED event arrives', () => {
      const fakeSocket = new FakeSocket();
      const handlers = {
        onStatus: jest.fn(),
        onOffer: jest.fn(),
        onDeliveryStatusUpdated: jest.fn(),
        onConnected: jest.fn(),
      };
      const liveConn = new LiveConnection(
        () => fakeSocket as unknown as any,
        handlers,
      );
      liveConn.open('http://localhost:3000', 'token-1');

      fakeSocket.emit(DELIVERY_STATUS_UPDATED_EVENT, {
        deliveryId: 'order-123',
        status: 'PICKED_UP',
      });

      expect(handlers.onDeliveryStatusUpdated).toHaveBeenCalledTimes(1);
    });
  });
});
