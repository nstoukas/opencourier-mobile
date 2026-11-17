import chatService, { ChatService, ChatSendInput } from './chatService';
import type { UClient } from '../Client';

describe('chatService (spec 0034, AC-4, AC-6, AC-10, AC-13, AC-20, Decision 111.12)', () => {
  let mockClient: jest.Mocked<UClient>;
  let service: ChatService;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    } as unknown as jest.Mocked<UClient>;

    service = chatService(mockClient);
  });

  describe('getMessages', () => {
    it('calls GET chat/messages with page params and returns result.messages', async () => {
      const messages = [
        {
          id: 'msg-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Hello',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:00:00Z',
        },
      ];
      mockClient.get.mockResolvedValueOnce({
        data: {
          result: { messages },
        },
      } as any);

      const result = await service.getMessages({ before: 'cursor-1' });

      expect(mockClient.get).toHaveBeenCalledWith('chat/messages', {
        params: { before: 'cursor-1' },
      });
      expect(result).toEqual(messages);
    });

    it('calls GET chat/messages with empty params by default', async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          result: { messages: [] },
        },
      } as any);

      const result = await service.getMessages();

      expect(mockClient.get).toHaveBeenCalledWith('chat/messages', {
        params: {},
      });
      expect(result).toEqual([]);
    });
  });

  describe('sendMessage', () => {
    it('calls POST chat/messages with body, deliveryId, clientMessageId and returns result', async () => {
      const input: ChatSendInput = {
        body: 'Arriving soon',
        deliveryId: 'del-123',
        clientMessageId: 'rider-abc-123',
      };
      const createdMessage = {
        id: 'msg-created-1',
        senderKind: 'COURIER',
        senderName: null,
        body: 'Arriving soon',
        deliveryId: 'del-123',
        orderReference: null,
        clientMessageId: 'rider-abc-123',
        createdAt: '2026-11-17T12:01:00Z',
      };
      mockClient.post.mockResolvedValueOnce({
        data: {
          result: createdMessage,
        },
      } as any);

      const result = await service.sendMessage(input);

      expect(mockClient.post).toHaveBeenCalledWith('chat/messages', input);
      expect(result).toEqual(createdMessage);
    });

    it('Decision 111.12: untagged message sends deliveryId: null and is passed to the client', async () => {
      const input: ChatSendInput = {
        body: 'General question for dispatch',
        deliveryId: null,
        clientMessageId: 'rider-untagged-456',
      };
      mockClient.post.mockResolvedValueOnce({
        data: {
          result: {
            id: 'msg-untagged-1',
            senderKind: 'COURIER',
            senderName: null,
            body: input.body,
            deliveryId: null,
            clientMessageId: input.clientMessageId,
            createdAt: '2026-11-17T12:02:00Z',
          },
        },
      } as any);

      const result = await service.sendMessage(input);

      expect(mockClient.post).toHaveBeenCalledWith('chat/messages', {
        body: 'General question for dispatch',
        deliveryId: null,
        clientMessageId: 'rider-untagged-456',
      });
      expect(result.deliveryId).toBeNull();
    });
  });

  describe('getQuickReplies', () => {
    it('calls GET chat/quick-replies and returns result.replies', async () => {
      const replies = ['Είμαι στην πόρτα', 'Το φαγητό δεν είναι έτοιμο'];
      mockClient.get.mockResolvedValueOnce({
        data: {
          result: { replies },
        },
      } as any);

      const result = await service.getQuickReplies();

      expect(mockClient.get).toHaveBeenCalledWith('chat/quick-replies');
      expect(result).toEqual(replies);
    });
  });

  describe('AC-6, AC-10, AC-20: no read marks to server, no timers/counts', () => {
    it('service exposes no method to send read receipts or tell the server the rider read anything', () => {
      const serviceMethods = Object.keys(service);
      expect(serviceMethods.sort()).toEqual(
        ['getMessages', 'getQuickReplies', 'sendMessage'].sort(),
      );

      // Verify no read route or mark method exists
      expect((service as any).markAsRead).toBeUndefined();
      expect((service as any).markSeen).toBeUndefined();
      expect((service as any).sendRead).toBeUndefined();
    });
  });
});
