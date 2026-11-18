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
import { clearChatOutgoing } from '@app/services/chat/chatOutgoing';

jest.mock('@app/services/service', () => ({
  services: {
    chatService: {
      getMessages: jest.fn(),
      sendMessage: jest.fn(),
      getQuickReplies: jest.fn(),
    },
  },
}));

const makeAxiosError = (status: number, message?: string) => {
  const error = new Error('Axios error') as any;
  error.isAxiosError = true;
  error.response = {
    status,
    data: message
      ? {
          result: [{ message }],
        }
      : {},
  };
  return error;
};

describe('useChat hooks (spec 0034, AC-4, AC-8, AC-12, AC-13, AC-19)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      clearChatOutgoing();
    });
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
  });

  afterEach(() => {
    act(() => {
      clearChatOutgoing();
    });
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

      const first = renderHook(() => useChatMessages(), { wrapper });
      await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
      expect(services.chatService.getMessages).toHaveBeenCalledTimes(1);
      first.unmount();

      const second = renderHook(() => useChatMessages(), { wrapper });
      await waitFor(() =>
        expect(services.chatService.getMessages).toHaveBeenCalledTimes(2),
      );
      second.unmount();
    });

    it('polls every 10 s (CHAT_POLL_MS) when poll is true, and does not poll when poll is false (AC-8)', async () => {
      jest.useFakeTimers();
      (services.chatService.getMessages as jest.Mock).mockResolvedValue([]);

      // 1. Polling hook
      const polling = renderHook(() => useChatMessages({ poll: true }), {
        wrapper,
      });

      await act(async () => {
        await Promise.resolve();
      });
      expect(services.chatService.getMessages).toHaveBeenCalledTimes(1);
      expect(CHAT_POLL_MS).toBe(10000);

      // Advance by 10 s -> second fetch
      await act(async () => {
        jest.advanceTimersByTime(CHAT_POLL_MS);
      });
      expect(services.chatService.getMessages).toHaveBeenCalledTimes(2);

      // Advance by another 10 s -> third fetch
      await act(async () => {
        jest.advanceTimersByTime(CHAT_POLL_MS);
      });
      expect(services.chatService.getMessages).toHaveBeenCalledTimes(3);

      polling.unmount();
      (services.chatService.getMessages as jest.Mock).mockClear();

      // 2. Non-polling hook
      const nonPolling = renderHook(() => useChatMessages({ poll: false }), {
        wrapper,
      });

      await act(async () => {
        await Promise.resolve();
      });
      expect(services.chatService.getMessages).toHaveBeenCalledTimes(1);

      // Advance by 20 s -> still only 1 fetch
      await act(async () => {
        jest.advanceTimersByTime(CHAT_POLL_MS * 2);
      });
      expect(services.chatService.getMessages).toHaveBeenCalledTimes(1);

      nonPolling.unmount();
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

      const { result, unmount } = renderHook(() => useChatQuickReplies(), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(services.chatService.getQuickReplies).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(replies);
      unmount();
    });
  });

  describe('useChatSender (AC-4, AC-13, AC-19, Major 3)', () => {
    it('send() trims text before sending and ignores blank or whitespace-only text', () => {
      const { result, unmount } = renderHook(() => useChatSender(), {
        wrapper,
      });

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
      unmount();
    });

    it('send() refuses text longer than 1000 characters (CHAT_MESSAGE_MAX_LENGTH)', () => {
      const { result, unmount } = renderHook(() => useChatSender(), {
        wrapper,
      });

      const overlongText = 'a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1);
      let sent = false;
      act(() => {
        sent = result.current.send(overlongText, 'del-1');
      });

      expect(sent).toBe(false);
      expect(services.chatService.sendMessage).not.toHaveBeenCalled();
      expect(result.current.outgoing).toEqual([]);
      unmount();
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

      const { result, unmount } = renderHook(() => useChatSender(), {
        wrapper,
      });

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
      unmount();
    });

    it('failed send stays with state "failed" and retry calls sendMessage with the SAME clientMessageId', async () => {
      (services.chatService.sendMessage as jest.Mock).mockRejectedValueOnce(
        new Error('Network error'),
      );

      const { result, unmount } = renderHook(() => useChatSender(), {
        wrapper,
      });

      await act(async () => {
        result.current.send('Need help', 'del-1');
      });

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

      expect(result.current.outgoing).toHaveLength(0);

      const cached = queryClient.getQueryData<ChatMessage[]>([
        QueryKeys.chatMessages,
      ]);
      expect(cached).toContainEqual(savedMessage);
      unmount();
    });

    it('a 4xx send shows the backend sentence under the message (Major 3)', async () => {
      const refusalError = makeAxiosError(
        400,
        'Cannot send message: content rejected by policy',
      );
      (services.chatService.sendMessage as jest.Mock).mockRejectedValueOnce(
        refusalError,
      );

      const { result, unmount } = renderHook(() => useChatSender(), {
        wrapper,
      });

      await act(async () => {
        result.current.send('Hello', 'del-1');
      });

      expect(result.current.outgoing).toHaveLength(1);
      const item = result.current.outgoing[0];
      expect(item.state).toBe('failed');
      expect(item.refusal).toBe(
        'Cannot send message: content rejected by policy',
      );
      expect(item.deliveryId).toBe('del-1');
      expect(item.tagDropped).toBeFalsy();
      unmount();
    });

    it('a 404 on a tagged send drops delivery tag and retry sends deliveryId null with SAME clientMessageId (Major 3)', async () => {
      const notOurOrderSentence =
        'This message cannot be linked to that order, because it is not one of your orders now';
      const error404 = makeAxiosError(404, notOurOrderSentence);

      (services.chatService.sendMessage as jest.Mock).mockRejectedValueOnce(
        error404,
      );

      const { result, unmount } = renderHook(() => useChatSender(), {
        wrapper,
      });

      await act(async () => {
        result.current.send('Is food ready?', 'del-tag-1');
      });

      expect(result.current.outgoing).toHaveLength(1);
      const failed = result.current.outgoing[0];
      expect(failed.state).toBe('failed');
      expect(failed.refusal).toBe(notOurOrderSentence);
      // Tag was dropped
      expect(failed.deliveryId).toBeNull();
      expect(failed.tagDropped).toBe(true);
      const originalClientId = failed.clientMessageId;

      // Retry sending the failed message
      (services.chatService.sendMessage as jest.Mock).mockResolvedValueOnce({
        id: 'msg-untagged-ok',
        senderKind: 'COURIER',
        senderName: null,
        body: 'Is food ready?',
        deliveryId: null,
        orderReference: null,
        clientMessageId: originalClientId,
        createdAt: '2026-11-17T12:05:00Z',
      });

      await act(async () => {
        await result.current.retry(failed);
      });

      // Verify retry sent deliveryId: null and SAME clientMessageId
      expect(services.chatService.sendMessage).toHaveBeenCalledTimes(2);
      expect(services.chatService.sendMessage).toHaveBeenLastCalledWith({
        body: 'Is food ready?',
        deliveryId: null,
        clientMessageId: originalClientId,
      });
      expect(result.current.outgoing).toHaveLength(0);
      unmount();
    });

    it('a network failure keeps the tag and plain retry (Major 3)', async () => {
      (services.chatService.sendMessage as jest.Mock).mockRejectedValueOnce(
        new Error('Network request failed'),
      );

      const { result, unmount } = renderHook(() => useChatSender(), {
        wrapper,
      });

      await act(async () => {
        result.current.send('On my way', 'del-tag-2');
      });

      expect(result.current.outgoing).toHaveLength(1);
      const failed = result.current.outgoing[0];
      expect(failed.state).toBe('failed');
      expect(failed.refusal).toBeUndefined();
      // Tag is NOT dropped
      expect(failed.deliveryId).toBe('del-tag-2');
      expect(failed.tagDropped).toBeFalsy();
      const originalClientId = failed.clientMessageId;

      (services.chatService.sendMessage as jest.Mock).mockResolvedValueOnce({
        id: 'msg-tagged-ok',
        senderKind: 'COURIER',
        senderName: null,
        body: 'On my way',
        deliveryId: 'del-tag-2',
        orderReference: null,
        clientMessageId: originalClientId,
        createdAt: '2026-11-17T12:06:00Z',
      });

      await act(async () => {
        await result.current.retry(failed);
      });

      expect(services.chatService.sendMessage).toHaveBeenCalledTimes(2);
      expect(services.chatService.sendMessage).toHaveBeenLastCalledWith({
        body: 'On my way',
        deliveryId: 'del-tag-2',
        clientMessageId: originalClientId,
      });
      expect(result.current.outgoing).toHaveLength(0);
      unmount();
    });
  });

  describe('useChatUnseen (AC-12)', () => {
    it('evaluates unseen status based on chatSeen module', async () => {
      jest.spyOn(chatSeenModule, 'loadChatSeen').mockResolvedValue(null);
      jest.spyOn(chatSeenModule, 'chatSeenNow').mockReturnValue(null);
      jest.spyOn(chatSeenModule, 'hasUnseenFromDispatch').mockReturnValue(true);

      const { result, unmount } = renderHook(() => useChatUnseen(), {
        wrapper,
      });

      await act(async () => {});

      expect(result.current).toBe(true);
      unmount();
    });
  });
});
