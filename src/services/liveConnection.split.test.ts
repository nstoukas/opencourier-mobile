import {
  LiveConnection,
  LiveConnectionHandlers,
  SPLIT_REQUEST_DECIDED_EVENT,
} from './liveConnection';

// A stand-in for the socket: it remembers listeners and lets the test fire an event.
class FakeSocket {
  connected = true;
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

describe('liveConnection SPLIT_REQUEST_DECIDED (spec 0047, AC-7, cross check 12)', () => {
  const open = (handlers: Partial<LiveConnectionHandlers>) => {
    let socket: FakeSocket | null = null;
    const connection = new LiveConnection(
      () => {
        socket = new FakeSocket();
        return socket as any;
      },
      {
        onStatus: jest.fn(),
        onOffer: jest.fn(),
        onDeliveryStatusUpdated: jest.fn(),
        onConnected: jest.fn(),
        ...handlers,
      } as LiveConnectionHandlers,
    );
    connection.open('http://localhost:3000', 'token-abc');
    return socket! as FakeSocket;
  };

  it('the event name is the one the server sends', () => {
    expect(SPLIT_REQUEST_DECIDED_EVENT).toBe('SPLIT_REQUEST_DECIDED');
  });

  it("passes dispatch's answer to onSplitRequestDecided", () => {
    const onSplitRequestDecided = jest.fn();
    const socket = open({ onSplitRequestDecided });
    const message = {
      deliveryId: 'del-1',
      outcome: 'CONFIRMED',
      adminNote: null,
      legNumber: 1,
      legCount: 2,
      boxSize: 'LARGE',
    };

    socket.emit(SPLIT_REQUEST_DECIDED_EVENT, message);

    expect(onSplitRequestDecided).toHaveBeenCalledTimes(1);
    expect(onSplitRequestDecided).toHaveBeenCalledWith(message);
  });

  it('does not throw when no handler was given (an older caller)', () => {
    const socket = open({});
    expect(() =>
      socket.emit(SPLIT_REQUEST_DECIDED_EVENT, { deliveryId: 'del-1' }),
    ).not.toThrow();
  });

  it('does not call the split handler for another event', () => {
    const onSplitRequestDecided = jest.fn();
    const socket = open({ onSplitRequestDecided });

    socket.emit('REMOVAL_REQUEST_DECIDED', { deliveryId: 'del-1' });

    expect(onSplitRequestDecided).not.toHaveBeenCalled();
  });
});
