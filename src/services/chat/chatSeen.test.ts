import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHAT_SEEN_KEY,
  chatSeenNow,
  clearChatSeen,
  hasUnseenFromDispatch,
  loadChatSeen,
  markChatSeen,
  newestFromDispatch,
  resetChatSeenCacheForTests,
  subscribeChatSeen,
} from './chatSeen';
import type { ChatMessage } from './chatService';

describe('chatSeen unread state (spec 0034, AC-12, Decision 111.2)', () => {
  beforeEach(async () => {
    resetChatSeenCacheForTests();
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    resetChatSeenCacheForTests();
    await AsyncStorage.clear();
  });

  describe('newestFromDispatch', () => {
    it('returns null when messages is empty, undefined or has no DISPATCH messages', () => {
      expect(newestFromDispatch(undefined)).toBeNull();
      expect(newestFromDispatch([])).toBeNull();

      const nonDispatchMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          senderKind: 'COURIER',
          senderName: null,
          body: 'Hello',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T10:00:00Z',
        },
        {
          id: 'msg-2',
          senderKind: 'SYSTEM',
          senderName: null,
          body: 'Reported issue',
          deliveryId: 'del-1',
          orderReference: 'ORD-1',
          createdAt: '2026-11-17T10:05:00Z',
        },
        {
          id: 'msg-3',
          senderKind: 'PARTNER',
          senderName: 'Restaurant',
          body: 'Where is the rider?',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T10:10:00Z',
        },
      ];
      expect(newestFromDispatch(nonDispatchMessages)).toBeNull();
    });

    it('returns the DISPATCH message with the latest createdAt', () => {
      const messages: ChatMessage[] = [
        {
          id: 'dispatch-older',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'First message',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T10:00:00Z',
        },
        {
          id: 'courier-newest',
          senderKind: 'COURIER',
          senderName: null,
          body: 'Rider reply',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T10:20:00Z',
        },
        {
          id: 'dispatch-newer',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Second message from dispatch',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T10:10:00Z',
        },
      ];

      const newest = newestFromDispatch(messages);
      expect(newest).not.toBeNull();
      expect(newest?.id).toBe('dispatch-newer');
    });
  });

  describe('hasUnseenFromDispatch', () => {
    it('is true only for a DISPATCH message newer than the stored mark', () => {
      const seen = { id: 'dispatch-1', createdAt: '2026-11-17T10:00:00Z' };

      const newerDispatch: ChatMessage[] = [
        {
          id: 'dispatch-2',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Wait 5 mins',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T10:05:00Z',
        },
      ];
      expect(hasUnseenFromDispatch(newerDispatch, seen)).toBe(true);
    });

    it('returns true when there is a DISPATCH message and no seen mark stored (seen is null)', () => {
      const messages: ChatMessage[] = [
        {
          id: 'dispatch-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Hello rider',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T10:00:00Z',
        },
      ];
      expect(hasUnseenFromDispatch(messages, null)).toBe(true);
    });

    it('returns false when the DISPATCH message matches or is older than the stored mark', () => {
      const seen = { id: 'dispatch-1', createdAt: '2026-11-17T10:00:00Z' };

      // Exact same message
      const sameMessage: ChatMessage[] = [
        {
          id: 'dispatch-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Hello',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T10:00:00Z',
        },
      ];
      expect(hasUnseenFromDispatch(sameMessage, seen)).toBe(false);

      // Older message
      const olderMessage: ChatMessage[] = [
        {
          id: 'dispatch-old',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Old',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T09:00:00Z',
        },
      ];
      expect(hasUnseenFromDispatch(olderMessage, seen)).toBe(false);
    });

    it('Decision 111.2: NEVER sets unseen to true for COURIER, PARTNER or SYSTEM messages', () => {
      const seen = { id: 'dispatch-1', createdAt: '2026-11-17T10:00:00Z' };

      // SYSTEM line newer than mark
      const systemMessages: ChatMessage[] = [
        {
          id: 'sys-1',
          senderKind: 'SYSTEM',
          senderName: null,
          body: 'Reported: Food not ready',
          deliveryId: 'del-1',
          orderReference: 'ORD-123',
          createdAt: '2026-11-17T10:15:00Z',
        },
      ];
      expect(hasUnseenFromDispatch(systemMessages, seen)).toBe(false);

      // Even with no seen mark, a SYSTEM message is never unseen
      expect(hasUnseenFromDispatch(systemMessages, null)).toBe(false);

      // COURIER message newer than mark
      const courierMessages: ChatMessage[] = [
        {
          id: 'cour-1',
          senderKind: 'COURIER',
          senderName: null,
          body: 'I am at the door',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T10:15:00Z',
        },
      ];
      expect(hasUnseenFromDispatch(courierMessages, seen)).toBe(false);
      expect(hasUnseenFromDispatch(courierMessages, null)).toBe(false);

      // PARTNER message newer than mark
      const partnerMessages: ChatMessage[] = [
        {
          id: 'part-1',
          senderKind: 'PARTNER',
          senderName: 'Restaurant',
          body: 'Order ready',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T10:15:00Z',
        },
      ];
      expect(hasUnseenFromDispatch(partnerMessages, seen)).toBe(false);
      expect(hasUnseenFromDispatch(partnerMessages, null)).toBe(false);
    });
  });

  describe('markChatSeen and clearChatSeen', () => {
    it('markChatSeen stores the newest dispatch message and notifies listeners', async () => {
      const listener = jest.fn();
      const unsubscribe = subscribeChatSeen(listener);

      const messages: ChatMessage[] = [
        {
          id: 'dispatch-100',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Notice',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T11:00:00Z',
        },
      ];

      await markChatSeen(messages);

      expect(listener).toHaveBeenCalledTimes(1);
      const seen = await loadChatSeen();
      expect(seen).toEqual({
        id: 'dispatch-100',
        createdAt: '2026-11-17T11:00:00Z',
      });
      expect(chatSeenNow()).toEqual({
        id: 'dispatch-100',
        createdAt: '2026-11-17T11:00:00Z',
      });

      // Verify persisted in AsyncStorage
      const stored = await AsyncStorage.getItem(CHAT_SEEN_KEY);
      expect(JSON.parse(stored!)).toEqual({
        id: 'dispatch-100',
        createdAt: '2026-11-17T11:00:00Z',
      });

      unsubscribe();
    });

    it('markChatSeen NEVER moves backwards in time', async () => {
      // First mark a newer message
      await markChatSeen([
        {
          id: 'dispatch-newer',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Newer',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:00:00Z',
        },
      ]);

      const listener = jest.fn();
      subscribeChatSeen(listener);

      // Now attempt to mark an older message
      await markChatSeen([
        {
          id: 'dispatch-older',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Older',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T11:00:00Z',
        },
      ]);

      // Listener not called, stored value not downgraded
      expect(listener).not.toHaveBeenCalled();
      const seen = await loadChatSeen();
      expect(seen?.id).toBe('dispatch-newer');
    });

    it('markChatSeen does nothing when there are no DISPATCH messages in the list', async () => {
      const listener = jest.fn();
      subscribeChatSeen(listener);

      await markChatSeen([
        {
          id: 'courier-1',
          senderKind: 'COURIER',
          senderName: null,
          body: 'Hello',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:00:00Z',
        },
      ]);

      expect(listener).not.toHaveBeenCalled();
      const seen = await loadChatSeen();
      expect(seen).toBeNull();
    });

    it('clearChatSeen empties the cached mark, removes storage, and notifies listeners', async () => {
      await markChatSeen([
        {
          id: 'dispatch-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Hi',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:00:00Z',
        },
      ]);
      expect(chatSeenNow()).not.toBeNull();

      const listener = jest.fn();
      const unsubscribe = subscribeChatSeen(listener);

      await clearChatSeen();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(chatSeenNow()).toBeNull();
      const raw = await AsyncStorage.getItem(CHAT_SEEN_KEY);
      expect(raw).toBeNull();

      unsubscribe();
    });
  });

  describe('loadChatSeen error handling', () => {
    it('returns null when storage contains invalid or corrupted JSON', async () => {
      await AsyncStorage.setItem(CHAT_SEEN_KEY, '{invalid-json');
      const seen = await loadChatSeen();
      expect(seen).toBeNull();
    });

    it('returns null when storage contains JSON with missing fields', async () => {
      await AsyncStorage.setItem(CHAT_SEEN_KEY, JSON.stringify({ id: 123 }));
      const seen = await loadChatSeen();
      expect(seen).toBeNull();
    });
  });
});
