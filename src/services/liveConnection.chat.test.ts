import {
  CHAT_MESSAGE_EVENT,
  CHAT_READ_BY_DISPATCH_EVENT,
  LiveConnection,
  LiveConnectionHandlers,
} from './liveConnection';

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

describe('liveConnection CHAT_MESSAGE and CHAT_READ_BY_DISPATCH (spec 0034, AC-8)', () => {
  it('fires onChatMessage when socket receives CHAT_MESSAGE_EVENT', () => {
    let fakeSocket: FakeSocket | null = null;
    const makeSocket = () => {
      fakeSocket = new FakeSocket();
      return fakeSocket as any;
    };

    const mockOnChatMessage = jest.fn();
    const handlers: LiveConnectionHandlers = {
      onStatus: jest.fn(),
      onOffer: jest.fn(),
      onDeliveryStatusUpdated: jest.fn(),
      onChatMessage: mockOnChatMessage,
      onConnected: jest.fn(),
    };

    const connection = new LiveConnection(makeSocket, handlers);
    connection.open('https://socket.example', 'courier-jwt');

    expect(fakeSocket).not.toBeNull();
    const messagePayload = {
      message: {
        id: 'msg-1',
        senderKind: 'DISPATCH',
        body: 'New message',
      },
    };
    fakeSocket!.emit(CHAT_MESSAGE_EVENT, messagePayload);

    expect(mockOnChatMessage).toHaveBeenCalledTimes(1);
    expect(mockOnChatMessage).toHaveBeenCalledWith(messagePayload);
    connection.close();
  });

  it('fires onChatReadByDispatch when socket receives CHAT_READ_BY_DISPATCH_EVENT', () => {
    let fakeSocket: FakeSocket | null = null;
    const makeSocket = () => {
      fakeSocket = new FakeSocket();
      return fakeSocket as any;
    };

    const mockOnChatReadByDispatch = jest.fn();
    const handlers: LiveConnectionHandlers = {
      onStatus: jest.fn(),
      onOffer: jest.fn(),
      onDeliveryStatusUpdated: jest.fn(),
      onChatReadByDispatch: mockOnChatReadByDispatch,
      onConnected: jest.fn(),
    };

    const connection = new LiveConnection(makeSocket, handlers);
    connection.open('https://socket.example', 'courier-jwt');

    expect(fakeSocket).not.toBeNull();
    fakeSocket!.emit(CHAT_READ_BY_DISPATCH_EVENT, {
      dispatchLastReadAt: '2026-11-17T12:00:00Z',
    });

    expect(mockOnChatReadByDispatch).toHaveBeenCalledTimes(1);
    connection.close();
  });
});
