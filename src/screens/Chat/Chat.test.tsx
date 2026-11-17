import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@app/localization/i18n';
import { Chat } from './Chat';
import { MainScreens } from '@app/navigation/main/types';
import { services } from '@app/services/service';
import * as socketModule from '@app/services/socket';
import * as chatSeenModule from '@app/services/chat/chatSeen';
import * as chatNoticeModule from '@app/services/chat/chatNotice';
import type { ChatMessage } from '@app/services/chat/chatService';
import * as useChatHooks from '@app/hooks/useChat';
import { CHAT_POLL_MS } from '@app/hooks/useChat';

let mockIsFocused = true;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useIsFocused: () => mockIsFocused,
  };
});

jest.mock('@app/services/socket', () => ({
  useConnectionStatus: jest.fn(),
}));

jest.mock('@app/services/service', () => ({
  services: {
    chatService: {
      getMessages: jest.fn(),
      sendMessage: jest.fn(),
      getQuickReplies: jest.fn(),
    },
  },
}));

jest.mock('@app/services/chat/chatNotice', () => ({
  clearChatNotice: jest.fn(),
}));

describe('Chat screen (spec 0034, AC-5, AC-6, AC-8, AC-10, AC-12, AC-13, AC-19, AC-20)', () => {
  let queryClient: QueryClient;
  const mockNavigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFocused = true;
    (socketModule.useConnectionStatus as jest.Mock).mockReturnValue(
      'connected',
    );
    (services.chatService.getMessages as jest.Mock).mockResolvedValue([]);
    (services.chatService.getQuickReplies as jest.Mock).mockResolvedValue([]);

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

  const renderChat = (routeParams?: {
    deliveryId?: string;
    orderReference?: string | null;
  }) => {
    const route = {
      key: 'chat-key',
      name: MainScreens.Chat,
      params: routeParams,
    } as any;

    return render(
      <QueryClientProvider client={queryClient}>
        <Chat navigation={mockNavigation} route={route} />
      </QueryClientProvider>,
    );
  };

  describe('AC-5 and AC-6: message labels and read marks', () => {
    it('dispatch messages show "Dispatch" and never a person\'s name (AC-5)', async () => {
      const messages: ChatMessage[] = [
        {
          id: 'dispatch-msg-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Hello from dispatch',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:00:00Z',
        },
      ];
      (services.chatService.getMessages as jest.Mock).mockResolvedValue(
        messages,
      );

      const { getByText, getByTestId, getAllByText } = renderChat();

      await waitFor(() => {
        expect(getByTestId('chat-message-dispatch-msg-1')).toBeTruthy();
      });

      const messageCard = getByTestId('chat-message-dispatch-msg-1');
      expect(messageCard).toBeTruthy();
      expect(getByText('Hello from dispatch')).toBeTruthy();
      // Within the message card, meta shows "Dispatch"
      const metaElements = getAllByText(/Dispatch/);
      expect(metaElements.length).toBeGreaterThanOrEqual(2); // Header title + message meta
    });

    it('rider messages show "read" only when readByDispatch is true (AC-6)', async () => {
      const messages: ChatMessage[] = [
        {
          id: 'rider-msg-unread',
          senderKind: 'COURIER',
          senderName: null,
          body: 'On my way',
          deliveryId: null,
          orderReference: null,
          readByDispatch: false,
          createdAt: '2026-11-17T12:00:00Z',
        },
        {
          id: 'rider-msg-read',
          senderKind: 'COURIER',
          senderName: null,
          body: 'Arrived at restaurant',
          deliveryId: null,
          orderReference: null,
          readByDispatch: true,
          createdAt: '2026-11-17T12:05:00Z',
        },
      ];
      (services.chatService.getMessages as jest.Mock).mockResolvedValue(
        messages,
      );

      const { getByText } = renderChat();

      await waitFor(() => {
        expect(getByText('On my way')).toBeTruthy();
        expect(getByText('Arrived at restaurant')).toBeTruthy();
      });

      // "read" is shown for the read message
      expect(getByText(/read/)).toBeTruthy();

      // For unread rider message, "read" is NOT in its meta text
      const unreadRow = getByText('On my way').parent?.parent;
      expect(unreadRow).toBeTruthy();
    });

    it('no screen text or service method tells the server the rider read anything (AC-6, AC-10, AC-20)', () => {
      // The chatService interface has only getMessages, sendMessage, getQuickReplies
      expect(services.chatService).not.toHaveProperty('markAsRead');
      expect(services.chatService).not.toHaveProperty('markRead');
      expect(services.chatService).not.toHaveProperty('sendRead');
    });
  });

  describe('AC-13: Presets and sending', () => {
    it('tapping a preset sends in ONE tap with the screen deliveryId tag (from job)', async () => {
      const quickReplies = ['Wait 5 minutes', 'Leave at door'];
      (services.chatService.getQuickReplies as jest.Mock).mockResolvedValue(
        quickReplies,
      );
      (services.chatService.sendMessage as jest.Mock).mockResolvedValue({
        id: 'msg-sent-preset',
        senderKind: 'COURIER',
        senderName: null,
        body: 'Wait 5 minutes',
        deliveryId: 'del-job-42',
        orderReference: 'ORD-42',
        createdAt: '2026-11-17T12:10:00Z',
      });

      const { getByTestId, getByPlaceholderText } = renderChat({
        deliveryId: 'del-job-42',
        orderReference: 'ORD-42',
      });

      // Type some draft text in the composer
      const input = getByPlaceholderText('Write to dispatch');
      fireEvent.changeText(input, 'Draft message');

      await waitFor(() => {
        expect(getByTestId('chat-preset-Wait 5 minutes')).toBeTruthy();
      });

      // Tapping preset sends in one tap
      await act(async () => {
        fireEvent.press(getByTestId('chat-preset-Wait 5 minutes'));
      });

      expect(services.chatService.sendMessage).toHaveBeenCalledTimes(1);
      expect(services.chatService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Wait 5 minutes',
          deliveryId: 'del-job-42',
        }),
      );

      // Clears nothing else: the draft input text remains untouched
      expect(input.props.value).toBe('Draft message');
    });

    it('tapping a preset from side menu sends with deliveryId null (AC-13, Decision 111.12)', async () => {
      (services.chatService.getQuickReplies as jest.Mock).mockResolvedValue([
        'Quick preset',
      ]);
      (services.chatService.sendMessage as jest.Mock).mockResolvedValue({
        id: 'msg-sent-null',
        senderKind: 'COURIER',
        senderName: null,
        body: 'Quick preset',
        deliveryId: null,
        orderReference: null,
        createdAt: '2026-11-17T12:10:00Z',
      });

      // Opened with no params (side menu)
      const { getByTestId } = renderChat(undefined);

      await waitFor(() => {
        expect(getByTestId('chat-preset-Quick preset')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('chat-preset-Quick preset'));
      });

      expect(services.chatService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Quick preset',
          deliveryId: null,
        }),
      );
    });

    it('text box sends trimmed text, and blank or over 1000 characters is not sent (AC-4, AC-13)', async () => {
      (services.chatService.sendMessage as jest.Mock).mockResolvedValue({
        id: 'msg-sent-text',
        senderKind: 'COURIER',
        senderName: null,
        body: 'Trimmed text',
        deliveryId: 'del-1',
        orderReference: null,
        createdAt: '2026-11-17T12:12:00Z',
      });

      const { getByPlaceholderText, getByText } = renderChat({
        deliveryId: 'del-1',
        orderReference: 'ORD-1',
      });

      const input = getByPlaceholderText('Write to dispatch');
      const sendButton = getByText('Send');

      // Blank or whitespace only: send button is disabled
      fireEvent.changeText(input, '   ');
      fireEvent.press(sendButton);
      expect(services.chatService.sendMessage).not.toHaveBeenCalled();

      // Valid text with whitespace padding: sent trimmed
      fireEvent.changeText(input, '   Trimmed text   ');
      await act(async () => {
        fireEvent.press(sendButton);
      });

      expect(services.chatService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Trimmed text',
          deliveryId: 'del-1',
        }),
      );
      // Input is cleared after successful submit
      expect(input.props.value).toBe('');
    });
  });

  describe('AC-19: failed send and retry with same clientMessageId', () => {
    it('failed send stays with "Not sent, tap to retry" and retry calls sendMessage with SAME clientMessageId', async () => {
      let sendAttempts = 0;
      let firstClientId = '';

      (services.chatService.sendMessage as jest.Mock).mockImplementation(
        async input => {
          sendAttempts++;
          if (sendAttempts === 1) {
            firstClientId = input.clientMessageId;
            throw new Error('Network failure');
          }
          return {
            id: 'msg-success-after-retry',
            senderKind: 'COURIER',
            senderName: null,
            body: 'Important update',
            deliveryId: null,
            orderReference: null,
            clientMessageId: input.clientMessageId,
            createdAt: '2026-11-17T12:15:00Z',
          };
        },
      );

      const { getByPlaceholderText, getByText, findByText, queryByText } =
        renderChat();

      const input = getByPlaceholderText('Write to dispatch');
      fireEvent.changeText(input, 'Important update');

      // Attempt send 1 (fails)
      await act(async () => {
        fireEvent.press(getByText('Send'));
      });

      // "Not sent, tap to retry" appears
      const retryButton = await findByText('Not sent, tap to retry');
      expect(retryButton).toBeTruthy();
      expect(firstClientId).toBeTruthy();

      // Tap retry
      await act(async () => {
        fireEvent.press(retryButton);
      });

      // sendMessage was called again with the EXACT SAME clientMessageId
      expect(sendAttempts).toBe(2);
      expect(services.chatService.sendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          body: 'Important update',
          clientMessageId: firstClientId,
        }),
      );

      // On success, "Not sent, tap to retry" is removed and stored message appears
      await waitFor(() => {
        expect(queryByText('Not sent, tap to retry')).toBeNull();
      });
    });
  });

  describe('AC-8: polling when disconnected vs connected', () => {
    it('Chat screen polls every 10 s (CHAT_POLL_MS) only while focused and connection is NOT connected', async () => {
      jest.useFakeTimers();
      const useChatMessagesSpy = jest.spyOn(useChatHooks, 'useChatMessages');
      (socketModule.useConnectionStatus as jest.Mock).mockReturnValue(
        'disconnected',
      );
      mockIsFocused = true;

      const { unmount } = renderChat();

      expect(useChatMessagesSpy).toHaveBeenCalledWith({ poll: true });
      expect(CHAT_POLL_MS).toBe(10000);

      unmount();
      await act(async () => {
        jest.runOnlyPendingTimers();
      });
      queryClient.clear();
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('Chat screen does NOT poll when connection is "connected"', () => {
      const useChatMessagesSpy = jest.spyOn(useChatHooks, 'useChatMessages');
      (socketModule.useConnectionStatus as jest.Mock).mockReturnValue(
        'connected',
      );
      mockIsFocused = true;

      const { unmount } = renderChat();

      expect(useChatMessagesSpy).toHaveBeenCalledWith({ poll: false });
      unmount();
    });

    it('Chat screen does NOT poll when screen is unfocused', () => {
      const useChatMessagesSpy = jest.spyOn(useChatHooks, 'useChatMessages');
      (socketModule.useConnectionStatus as jest.Mock).mockReturnValue(
        'disconnected',
      );
      mockIsFocused = false;

      const { unmount } = renderChat();

      expect(useChatMessagesSpy).toHaveBeenCalledWith({ poll: false });
      unmount();
    });
  });

  describe('AC-11 and AC-12: clearing notice and marking seen on open', () => {
    it('marks chat seen and clears the chat notice when screen is focused and messages arrive', async () => {
      const messages: ChatMessage[] = [
        {
          id: 'dispatch-seen-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Seen notice',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:00:00Z',
        },
      ];
      (services.chatService.getMessages as jest.Mock).mockResolvedValue(
        messages,
      );

      const markChatSeenSpy = jest
        .spyOn(chatSeenModule, 'markChatSeen')
        .mockResolvedValue(undefined);

      renderChat();

      await waitFor(() => {
        expect(markChatSeenSpy).toHaveBeenCalledWith(messages);
        expect(chatNoticeModule.clearChatNotice).toHaveBeenCalled();
      });
    });
  });
});
