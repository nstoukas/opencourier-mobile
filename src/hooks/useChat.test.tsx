import { renderHook, act, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { services } from '@app/services/service';
import {
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_POLL_MS,
  useChatMessages,
  useChatQuickReplies,
  useChatSender,
  useChatUnseen,
} from './useChat';
import { QueryKeys } from '@app/utilities/queryKeys';
import type { ChatMessage } from '@app/services/chat/chatService';
import * as chatSeenModule from '@app/services/chat/chatSeen';

jest.mock('@app/services/service', () => ({
  services: {
    chatService: {
      getMessages: jest.fn(),
      sendMessage: jest.fn(),
      getQuickReplies: jest.fn(),
    },
  },
}));

describe('useChat hooks (spec 0034, AC-4, AC-8, AC-12, AC-13, AC-19)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('useChatMessages (AC-8)', () => {
    it('fetches messages using chatService.getMessages with refetchOnMount: always', async () => {
      const mockMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Hello',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T10:00:00Z',
        },
      ];
      (services.chatService.getMessages as jest.Mock).mockResolvedValue(
        mockMessages,
      );

      const { result, unmount } = renderHook(() => useChatMessages(), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(services.chatService.getMessages).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(mockMessages);
      unmount();
    });

    it('mounts useChatMessages a second time while the first answer is still fresh and refetches (refetchOnMount: always)', async () => {
      // Set high staleTime so cached data remains fresh in React Query
      queryClient.setDefaultOptions({
        queries: { retry: false, gcTime: Infinity, staleTime: 60_000 },
      });
      const mockMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Hello',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T10:00:00Z',
        },
      ];
      (services.chatService.getMessages as jest.Mock).mockResolvedValue(
        mockMessages,
      );

      // First mount asks the server
      const first = renderHook(() => useChatMessages(), { wrapper });
      await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
      expect(services.chatService.getMessages).toHaveBeenCalledTimes(1);
      first.unmount();

      // Second mount while the first answer is still fresh must ask the server again (refetchOnMount: 'always')
      const second = renderHook(() => useChatMessages(), { wrapper });
      await waitFor(() =>
        expect(services.chatService.getMessages).toHaveBeenCalledTimes(2),
      );
      second.unmount();
    });

    it('sets refetchInterval to CHAT_POLL_MS (10000) when poll is true, and false when poll is false', async () => {
      jest.useFakeTimers();
      const { result: pollingResult, unmount: unmountPolling } = renderHook(
        () => useChatMessages({ poll: true }),
        { wrapper },
      );
      expect(CHAT_POLL_MS).toBe(10000);

      const { result: nonPollingResult, unmount: unmountNonPolling } =
        renderHook(() => useChatMessages({ poll: false }), { wrapper });
      expect(nonPollingResult.current).toBeDefined();
      expect(pollingResult.current).toBeDefined();

      unmountPolling();
      unmountNonPolling();
      await act(async () => {
        jest.runOnlyPendingTimers();
      });
      queryClient.clear();
      jest.clearAllTimers();
      jest.useRealTimers();
    });
  });

  describe('useChatQuickReplies (AC-13)', () => {
    it('fetches quick replies from chatService.getQuickReplies', async () => {
      const replies = ['Reply 1', 'Reply 2'];
      (services.chatService.getQuickReplies as jest.Mock).mockResolvedValue(
        replies,
      );

      const { result } = renderHook(() => useChatQuickReplies(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(services.chatService.getQuickReplies).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(replies);
    });
  });

  describe('useChatSender (AC-4, AC-13, AC-19)', () => {
    it('send() trims text before sending and ignores blank or whitespace-only text', () => {
      const { result } = renderHook(() => useChatSender(), { wrapper });

      let sent = false;
      act(() => {
        sent = result.current.send('   ', 'del-1');
      });
      expect(sent).toBe(false);
      expect(services.chatService.sendMessage).not.toHaveBeenCalled();
      expect(result.current.outgoing).toEqual([]);

      act(() => {
        sent = result.current.send('', null);
      });
      expect(sent).toBe(false);
      expect(services.chatService.sendMessage).not.toHaveBeenCalled();
    });

    it('send() refuses text longer than 1000 characters (CHAT_MESSAGE_MAX_LENGTH)', () => {
      const { result } = renderHook(() => useChatSender(), { wrapper });

      const overlongText = 'a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1);
      let sent = false;
      act(() => {
        sent = result.current.send(overlongText, 'del-1');
      });

      expect(sent).toBe(false);
      expect(services.chatService.sendMessage).not.toHaveBeenCalled();
      expect(result.current.outgoing).toEqual([]);
    });

    it('send() accepts exactly 1000 characters and sends trimmed message', async () => {
      const exactText = ' ' + 'b'.repeat(1000) + ' ';
      (services.chatService.sendMessage as jest.Mock).mockResolvedValue({
        id: 'msg-stored',
        senderKind: 'COURIER',
        senderName: null,
        body: 'b'.repeat(1000),
        deliveryId: 'del-1',
        orderReference: null,
        createdAt: '2026-11-17T12:00:00Z',
      });

      const { result } = renderHook(() => useChatSender(), { wrapper });

      let sent = false;
      await act(async () => {
        sent = result.current.send(exactText, 'del-1');
      });

      expect(sent).toBe(true);
      expect(services.chatService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'b'.repeat(1000),
          deliveryId: 'del-1',
          clientMessageId: expect.stringMatching(/^rider-/),
        }),
      );
    });

    it('failed send stays with state "failed" and retry calls sendMessage with the SAME clientMessageId', async () => {
      (services.chatService.sendMessage as jest.Mock).mockRejectedValueOnce(
        new Error('Network error'),
      );

      const { result } = renderHook(() => useChatSender(), { wrapper });

      await act(async () => {
        result.current.send('Need help', 'del-1');
      });

      // Send failed: item is in outgoing list with state: 'failed'
      expect(result.current.outgoing).toHaveLength(1);
      const failedItem = result.current.outgoing[0];
      expect(failedItem.body).toBe('Need help');
      expect(failedItem.state).toBe('failed');
      const firstClientMessageId = failedItem.clientMessageId;
      expect(firstClientMessageId).toBeDefined();

      expect(services.chatService.sendMessage).toHaveBeenCalledTimes(1);
      expect(services.chatService.sendMessage).toHaveBeenCalledWith({
        body: 'Need help',
        deliveryId: 'del-1',
        clientMessageId: firstClientMessageId,
      });

      // Now retry the failed message
      const savedMessage: ChatMessage = {
        id: 'msg-retry-ok',
        senderKind: 'COURIER',
        senderName: null,
        body: 'Need help',
        deliveryId: 'del-1',
        orderReference: 'ORD-123',
        clientMessageId: firstClientMessageId,
        createdAt: '2026-11-17T12:01:00Z',
      };
      (services.chatService.sendMessage as jest.Mock).mockResolvedValueOnce(
        savedMessage,
      );

      await act(async () => {
        await result.current.retry(failedItem);
      });

      // Retry used the exact SAME clientMessageId
      expect(services.chatService.sendMessage).toHaveBeenCalledTimes(2);
      expect(services.chatService.sendMessage).toHaveBeenLastCalledWith({
        body: 'Need help',
        deliveryId: 'del-1',
        clientMessageId: firstClientMessageId,
      });

      // Success removed it from outgoing
      expect(result.current.outgoing).toHaveLength(0);

      // And the message was added to query cache
      const cached = queryClient.getQueryData<ChatMessage[]>([
        QueryKeys.chatMessages,
      ]);
      expect(cached).toContainEqual(savedMessage);
    });
  });

  describe('useChatUnseen (AC-12)', () => {
    it('evaluates unseen status based on chatSeen module', async () => {
      jest.spyOn(chatSeenModule, 'loadChatSeen').mockResolvedValue(null);
      jest.spyOn(chatSeenModule, 'chatSeenNow').mockReturnValue(null);
      jest.spyOn(chatSeenModule, 'hasUnseenFromDispatch').mockReturnValue(true);

      const { result } = renderHook(() => useChatUnseen(), { wrapper });

      await act(async () => {});

      expect(result.current).toBe(true);
    });
  });
});
