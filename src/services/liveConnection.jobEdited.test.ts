import {
  LiveConnection,
  LiveConnectionHandlers,
  JOB_EDITED_EVENT,
} from './liveConnection';

// Stand-in for socket: records listeners and lets tests fire events.
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

// Row 164 (AC-1): liveConnection forwards JOB_EDITED to onJobEdited handler.
describe('liveConnection JOB_EDITED (row 164, AC-1)', () => {
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
    connection.open('http://localhost:3000', 'token-xyz');
    return socket! as FakeSocket;
  };

  it('the event name matches what the server sends', () => {
    expect(JOB_EDITED_EVENT).toBe('JOB_EDITED');
  });

  it('forwards the raw JOB_EDITED message to onJobEdited', () => {
    const onJobEdited = jest.fn();
    const socket = open({ onJobEdited });
    const message = {
      deliveryId: 'del-101',
      restaurantName: 'Volos Grill',
      changed: ['NOTES', 'TIMES'],
      editedAt: '2026-11-25T14:00:00.000Z',
    };

    socket.emit(JOB_EDITED_EVENT, message);

    expect(onJobEdited).toHaveBeenCalledTimes(1);
    expect(onJobEdited).toHaveBeenCalledWith(message);
  });

  it('does not throw when no onJobEdited handler is registered', () => {
    const socket = open({});
    expect(() =>
      socket.emit(JOB_EDITED_EVENT, { deliveryId: 'del-101' }),
    ).not.toThrow();
  });

  it('does not call onJobEdited for other socket events', () => {
    const onJobEdited = jest.fn();
    const socket = open({ onJobEdited });

    socket.emit('JOB_READY_UPDATED', { deliveryId: 'del-101' });
    socket.emit('REMOVAL_REQUEST_DECIDED', { deliveryId: 'del-101' });

    expect(onJobEdited).not.toHaveBeenCalled();
  });
});
