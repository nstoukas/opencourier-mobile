import {
  LiveConnection,
  LiveConnectionHandlers,
  REMOVAL_REQUEST_DECIDED_EVENT,
} from './liveConnection';

// Fake socket implementing EventEmitter
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
    const list = this.events.get(event) ?? [];
    for (const listener of [...list]) {
      listener(...args);
    }
  }

  connect() {}
  disconnect() {}
  removeAllListeners() {
    this.events.clear();
  }
}

describe('liveConnection REMOVAL_REQUEST_DECIDED (spec 0035, AC-11)', () => {
  it('passes REMOVAL_REQUEST_DECIDED payload to onRemovalRequestDecided handler', () => {
    let fakeSocket: FakeSocket | null = null;
    const makeSocket = () => {
      fakeSocket = new FakeSocket();
      return fakeSocket as any;
    };

    const mockOnRemoval = jest.fn();
    const handlers: LiveConnectionHandlers = {
      onStatus: jest.fn(),
      onOffer: jest.fn(),
      onDeliveryStatusUpdated: jest.fn(),
      onRemovalRequestDecided: mockOnRemoval,
      onConnected: jest.fn(),
    };

    const connection = new LiveConnection(makeSocket, handlers);
    connection.open('http://localhost:3000', 'token-abc');

    const removalMessage = {
      deliveryId: 'del-socket-1',
      outcome: 'APPROVED',
      paid: true,
      payAmount: 350,
      currencyCode: 'EUR',
    };

    fakeSocket!.emit(REMOVAL_REQUEST_DECIDED_EVENT, removalMessage);

    expect(mockOnRemoval).toHaveBeenCalledWith(removalMessage);
  });
});
