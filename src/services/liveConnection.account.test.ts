import { LiveConnection, LiveConnectionHandlers } from './liveConnection';

// Minimal fake socket: what LiveConnection listens on, and a way to fire it.
class FakeSocket {
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

// What socket.io hands a `connect_error` listener when the server's middleware refuses the connection:
// an Error whose `data` is what the server attached.
const refusal = (message: string, data?: unknown) =>
  Object.assign(new Error(message), data === undefined ? {} : { data });

const DEACTIVATED_SENTENCE =
  'Your account was deactivated by the co-op. If you think this is a mistake, call the co-op on +30 24210 12345.';

// Row 108 review (ruling: "A socket refused for a deactivated account shows no notice"; spec 0051, AC-9):
// where the connection error is read, the server's code and sentence are handed on, so the app can end the
// session with the same notice as a refused renewal.
describe('LiveConnection: a connection the server refused with a code (spec 0051, row 108 review)', () => {
  let socket: FakeSocket;
  let handlers: { [K in keyof LiveConnectionHandlers]-?: jest.Mock };
  let connection: LiveConnection;

  beforeEach(() => {
    socket = new FakeSocket();
    handlers = {
      onStatus: jest.fn(),
      onOffer: jest.fn(),
      onOfferEnded: jest.fn(),
      onDeliveryStatusUpdated: jest.fn(),
      onJobReadyUpdated: jest.fn(),
      onRemovalRequestDecided: jest.fn(),
      onSplitRequestDecided: jest.fn(),
      onChatMessage: jest.fn(),
      onChatReadByDispatch: jest.fn(),
      onRefusedWithCode: jest.fn(),
      onConnected: jest.fn(),
    };
    connection = new LiveConnection(() => socket as unknown as any, handlers);
    connection.open('http://localhost:3000', 'token-1');
  });

  it('ACCOUNT_DEACTIVATED: onRefusedWithCode gets the code and the sentence of the error', () => {
    socket.active = false;

    socket.emit(
      'connect_error',
      refusal(DEACTIVATED_SENTENCE, { code: 'ACCOUNT_DEACTIVATED' }),
    );

    expect(handlers.onRefusedWithCode).toHaveBeenCalledTimes(1);
    expect(handlers.onRefusedWithCode).toHaveBeenCalledWith(
      'ACCOUNT_DEACTIVATED',
      DEACTIVATED_SENTENCE,
    );
  });

  it('CREDENTIALS_CHANGED: the code and its sentence too', () => {
    socket.active = false;

    socket.emit(
      'connect_error',
      refusal('Your password or login email was changed. Log in again.', {
        code: 'CREDENTIALS_CHANGED',
      }),
    );

    expect(handlers.onRefusedWithCode).toHaveBeenCalledWith(
      'CREDENTIALS_CHANGED',
      'Your password or login email was changed. Log in again.',
    );
  });

  it('whatever code the server names is handed on as it is; deciding what it means is not done here', () => {
    socket.emit(
      'connect_error',
      refusal('Unauthorized', { code: 'JWT_EXPIRED' }),
    );

    expect(handlers.onRefusedWithCode).toHaveBeenCalledWith(
      'JWT_EXPIRED',
      'Unauthorized',
    );
  });

  it('the status still follows the socket: refused when socket.io gave up, disconnected while it retries', () => {
    socket.active = false;
    socket.emit(
      'connect_error',
      refusal(DEACTIVATED_SENTENCE, { code: 'ACCOUNT_DEACTIVATED' }),
    );
    expect(connection.getStatus()).toBe('refused');

    socket.active = true;
    socket.emit(
      'connect_error',
      refusal(DEACTIVATED_SENTENCE, { code: 'ACCOUNT_DEACTIVATED' }),
    );
    expect(connection.getStatus()).toBe('disconnected');
  });

  it.each([
    ['a plain network error with no data', refusal('xhr poll error')],
    ['data with no code', refusal('Unauthorized', {})],
    ['a code that is not text', refusal('Unauthorized', { code: 401 })],
    ['a null code', refusal('Unauthorized', { code: null })],
    ['null data', refusal('Unauthorized', null)],
    ['no error at all', undefined],
  ])(
    '%s: onRefusedWithCode is not called, and nothing throws',
    (_name, error) => {
      socket.active = false;

      expect(() => socket.emit('connect_error', error)).not.toThrow();

      expect(handlers.onRefusedWithCode).not.toHaveBeenCalled();
      expect(connection.getStatus()).toBe('refused');
    },
  );

  it('a connection with no onRefusedWithCode handler does not throw on a coded refusal', () => {
    const bare = new FakeSocket();
    const onStatus = jest.fn();
    const withoutHandler = new LiveConnection(() => bare as unknown as any, {
      onStatus,
      onOffer: jest.fn(),
      onDeliveryStatusUpdated: jest.fn(),
      onConnected: jest.fn(),
    });
    withoutHandler.open('http://localhost:3000', 'token-1');
    bare.active = false;

    expect(() =>
      bare.emit(
        'connect_error',
        refusal(DEACTIVATED_SENTENCE, { code: 'ACCOUNT_DEACTIVATED' }),
      ),
    ).not.toThrow();
    expect(withoutHandler.getStatus()).toBe('refused');
  });

  it('other socket events never call it', () => {
    socket.emit('connect');
    socket.emit('disconnect', 'io server disconnect');

    expect(handlers.onRefusedWithCode).not.toHaveBeenCalled();
  });
});
