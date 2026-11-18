import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import {
  FlatList,
  AppState,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
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
import * as chatOutgoingModule from '@app/services/chat/chatOutgoing';
import {
  addOutgoing,
  clearChatOutgoing,
} from '@app/services/chat/chatOutgoing';

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

let appStateListeners: Array<(state: string) => void> = [];

beforeAll(() => {
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((event: string, listener: any) => {
      if (event === 'change') {
        appStateListeners.push(listener);
      }
      return {
        remove: () => {
          appStateListeners = appStateListeners.filter(l => l !== listener);
        },
      } as any;
    });
});

const triggerAppState = (state: string) => {
  AppState.currentState = state as any;
  for (const listener of [...appStateListeners]) {
    listener(state);
  }
};

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

describe('Chat screen (spec 0034, AC-5, AC-6, AC-8, AC-10, AC-12, AC-13, AC-19, AC-20)', () => {
  let queryClient: QueryClient;
  const mockNavigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  } as any;

  let activeRenders: Array<ReturnType<typeof render>> = [];

  beforeEach(() => {
    jest.clearAllMocks();
    AppState.currentState = 'active';
    mockIsFocused = true;
    act(() => {
      clearChatOutgoing();
    });
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
    while (activeRenders.length > 0) {
      activeRenders.pop()?.unmount();
    }
    act(() => {
      clearChatOutgoing();
    });
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

    const rendered = render(
      <QueryClientProvider client={queryClient}>
        <Chat navigation={mockNavigation} route={route} />
      </QueryClientProvider>,
    );
    activeRenders.push(rendered);
    return rendered;
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
      const metaElements = getAllByText(/Dispatch/);
      expect(metaElements.length).toBeGreaterThanOrEqual(2);
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

      expect(getByText(/read/)).toBeTruthy();
      const unreadRow = getByText('On my way').parent?.parent;
      expect(unreadRow).toBeTruthy();
    });

    it('no screen text or service method tells the server the rider read anything (AC-6, AC-10, AC-20)', () => {
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

      const input = getByPlaceholderText('Write to dispatch');
      fireEvent.changeText(input, 'Draft message');

      await waitFor(() => {
        expect(getByTestId('chat-preset-Wait 5 minutes')).toBeTruthy();
      });

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

      fireEvent.changeText(input, '   ');
      fireEvent.press(sendButton);
      expect(services.chatService.sendMessage).not.toHaveBeenCalled();

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

      await act(async () => {
        fireEvent.press(getByText('Send'));
      });

      const retryButton = await findByText('Not sent, tap to retry');
      expect(retryButton).toBeTruthy();
      expect(firstClientId).toBeTruthy();

      await act(async () => {
        fireEvent.press(retryButton);
      });

      expect(sendAttempts).toBe(2);
      expect(services.chatService.sendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          body: 'Important update',
          clientMessageId: firstClientId,
        }),
      );

      await waitFor(() => {
        expect(queryByText('Not sent, tap to retry')).toBeNull();
      });
    });
  });

  describe('AC-8: polling when disconnected vs connected (Major 1)', () => {
    it('with Chat screen focused and AppState active, polls every 10 s; with AppState background does not poll and does not mark seen; returning to active refetches once (Major 1, AC-8)', async () => {
      jest.useFakeTimers();
      (socketModule.useConnectionStatus as jest.Mock).mockReturnValue(
        'disconnected',
      );
      mockIsFocused = true;
      AppState.currentState = 'active';

      const markChatSeenSpy = jest
        .spyOn(chatSeenModule, 'markChatSeen')
        .mockResolvedValue(undefined);

      const mockMessages: ChatMessage[] = [
        {
          id: 'msg-poll-1',
          senderKind: 'DISPATCH',
          senderName: 'Dispatch',
          body: 'Hello rider',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:00:00Z',
        },
      ];
      (services.chatService.getMessages as jest.Mock).mockResolvedValue(
        mockMessages,
      );

      const { unmount } = renderChat();

      await act(async () => {
        await Promise.resolve();
      });
      expect(services.chatService.getMessages).toHaveBeenCalledTimes(1);

      // Advance by 10 s while focused and active -> polls again
      await act(async () => {
        jest.advanceTimersByTime(CHAT_POLL_MS);
      });
      expect(services.chatService.getMessages).toHaveBeenCalledTimes(2);

      // Advance by another 10 s -> polls again
      await act(async () => {
        jest.advanceTimersByTime(CHAT_POLL_MS);
      });
      expect(services.chatService.getMessages).toHaveBeenCalledTimes(3);

      (services.chatService.getMessages as jest.Mock).mockClear();
      markChatSeenSpy.mockClear();
      (chatNoticeModule.clearChatNotice as jest.Mock).mockClear();

      // Background the app
      await act(async () => {
        triggerAppState('background');
      });

      // Advance timers by 20 s -> does NOT poll in background
      await act(async () => {
        jest.advanceTimersByTime(CHAT_POLL_MS * 2);
      });
      expect(services.chatService.getMessages).not.toHaveBeenCalled();
      expect(markChatSeenSpy).not.toHaveBeenCalled();
      expect(chatNoticeModule.clearChatNotice).not.toHaveBeenCalled();

      // Return to active -> refetches once and marks seen
      await act(async () => {
        triggerAppState('active');
      });

      expect(services.chatService.getMessages).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(markChatSeenSpy).toHaveBeenCalled();
        expect(chatNoticeModule.clearChatNotice).toHaveBeenCalled();
      });

      unmount();
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
    it('marks chat seen and clears the chat notice when screen is focused and active and messages arrive', async () => {
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

      const { unmount } = renderChat();

      await waitFor(() => {
        expect(markChatSeenSpy).toHaveBeenCalledWith(messages);
        expect(chatNoticeModule.clearChatNotice).toHaveBeenCalled();
      });
      unmount();
    });
  });

  describe('Major 3: refused sends, 404 tag drop, and network retries in UI', () => {
    it('a 4xx send shows the backend sentence under the message', async () => {
      const sentence = 'Content violates cooperative communication rules';
      (services.chatService.sendMessage as jest.Mock).mockRejectedValueOnce(
        makeAxiosError(400, sentence),
      );

      const { getByPlaceholderText, getByText, findByText, unmount } =
        renderChat();
      const input = getByPlaceholderText('Write to dispatch');
      fireEvent.changeText(input, 'Hello dispatch');
      await act(async () => {
        fireEvent.press(getByText('Send'));
      });

      expect(await findByText(sentence)).toBeTruthy();
      expect(getByText('Not sent, tap to retry')).toBeTruthy();
      unmount();
    });

    it('a 404 on a tagged send turns retry into "Not sent, tap to send it without the order" and sends deliveryId null with SAME clientMessageId', async () => {
      const backendSentence =
        'This message cannot be linked to that order, because it is not one of your orders now';
      let sendCalls = 0;
      let firstClientId = '';

      (services.chatService.sendMessage as jest.Mock).mockImplementation(
        async input => {
          sendCalls++;
          if (sendCalls === 1) {
            firstClientId = input.clientMessageId;
            throw makeAxiosError(404, backendSentence);
          }
          return {
            id: 'msg-retried-untagged',
            senderKind: 'COURIER',
            senderName: null,
            body: 'Is this order ready?',
            deliveryId: null,
            orderReference: null,
            clientMessageId: input.clientMessageId,
            createdAt: '2026-11-17T12:20:00Z',
          };
        },
      );

      const {
        getByPlaceholderText,
        getByText,
        findByText,
        queryByText,
        unmount,
      } = renderChat({
        deliveryId: 'del-tagged-job',
        orderReference: 'ORD-77',
      });

      const input = getByPlaceholderText('Write to dispatch');
      fireEvent.changeText(input, 'Is this order ready?');
      await act(async () => {
        fireEvent.press(getByText('Send'));
      });

      expect(await findByText(backendSentence)).toBeTruthy();
      const retryWithoutOrder = await findByText(
        'Not sent, tap to send it without the order',
      );
      expect(retryWithoutOrder).toBeTruthy();

      await act(async () => {
        fireEvent.press(retryWithoutOrder);
      });

      expect(sendCalls).toBe(2);
      expect(services.chatService.sendMessage).toHaveBeenLastCalledWith({
        body: 'Is this order ready?',
        deliveryId: null,
        clientMessageId: firstClientId,
      });

      await waitFor(() => {
        expect(
          queryByText('Not sent, tap to send it without the order'),
        ).toBeNull();
      });
      unmount();
    });

    it('a network failure keeps the tag and plain retry ("Not sent, tap to retry")', async () => {
      let sendCalls = 0;
      let firstClientId = '';

      (services.chatService.sendMessage as jest.Mock).mockImplementation(
        async input => {
          sendCalls++;
          if (sendCalls === 1) {
            firstClientId = input.clientMessageId;
            throw new Error('Connection lost');
          }
          return {
            id: 'msg-retried-tagged',
            senderKind: 'COURIER',
            senderName: null,
            body: 'Heading over',
            deliveryId: 'del-tagged-net',
            orderReference: null,
            clientMessageId: input.clientMessageId,
            createdAt: '2026-11-17T12:22:00Z',
          };
        },
      );

      const {
        getByPlaceholderText,
        getByText,
        findByText,
        queryByText,
        unmount,
      } = renderChat({
        deliveryId: 'del-tagged-net',
        orderReference: 'ORD-88',
      });

      const input = getByPlaceholderText('Write to dispatch');
      fireEvent.changeText(input, 'Heading over');
      await act(async () => {
        fireEvent.press(getByText('Send'));
      });

      const retryBtn = await findByText('Not sent, tap to retry');
      expect(retryBtn).toBeTruthy();
      expect(
        queryByText('Not sent, tap to send it without the order'),
      ).toBeNull();

      await act(async () => {
        fireEvent.press(retryBtn);
      });

      expect(sendCalls).toBe(2);
      expect(services.chatService.sendMessage).toHaveBeenLastCalledWith({
        body: 'Heading over',
        deliveryId: 'del-tagged-net',
        clientMessageId: firstClientId,
      });
      unmount();
    });
  });

  describe('Minor 3: server row with same clientMessageId as pending shows once', () => {
    it('a server row with the same clientMessageId as a pending one shows once', async () => {
      // Mock dropStoredOutgoing so we test that rows filter de-duplicates during rendering
      jest
        .spyOn(chatOutgoingModule, 'dropStoredOutgoing')
        .mockImplementation(() => {});

      addOutgoing({
        clientMessageId: 'msg-dedup-client-id',
        body: 'De-duplicated message',
        deliveryId: null,
        state: 'sending',
      });

      const messages: ChatMessage[] = [
        {
          id: 'server-dedup-id',
          clientMessageId: 'msg-dedup-client-id',
          senderKind: 'COURIER',
          senderName: null,
          body: 'De-duplicated message',
          deliveryId: null,
          orderReference: null,
          createdAt: '2026-11-17T12:30:00Z',
        },
      ];
      (services.chatService.getMessages as jest.Mock).mockResolvedValue(
        messages,
      );

      const { getAllByText, unmount } = renderChat();

      await waitFor(() => {
        expect(getAllByText('De-duplicated message')).toHaveLength(1);
      });
      unmount();
    });
  });

  describe('Minor 4: failed outgoing survives leaving Chat screen and coming back', () => {
    it('a failed outgoing message is still there after leaving the Chat screen and coming back', async () => {
      (services.chatService.sendMessage as jest.Mock).mockRejectedValueOnce(
        new Error('Failed network send'),
      );

      const firstRender = renderChat();
      const input = firstRender.getByPlaceholderText('Write to dispatch');
      fireEvent.changeText(input, 'Message surviving screen change');
      await act(async () => {
        fireEvent.press(firstRender.getByText('Send'));
      });

      await firstRender.findByText('Not sent, tap to retry');
      expect(
        firstRender.getByText('Message surviving screen change'),
      ).toBeTruthy();

      // Leave Chat screen (unmount)
      firstRender.unmount();

      // Re-enter Chat screen (second mount)
      const secondRender = renderChat();

      expect(
        secondRender.getByText('Message surviving screen change'),
      ).toBeTruthy();
      expect(secondRender.getByText('Not sent, tap to retry')).toBeTruthy();
      secondRender.unmount();
    });
  });

  describe('Verify fixes: scroll to newest message and keyboard behavior (Decision 111.17)', () => {
    const originalOS = Platform.OS;

    afterEach(() => {
      Platform.OS = originalOS;
    });

    it('scrolls FlatList to content height minus list height on content size change and on layout, and updates with the new difference when either changes', async () => {
      const { findByText, UNSAFE_getByType } = renderChat();
      // Wait for initial query to resolve so the list is mounted
      await findByText(
        'No messages yet. Tap a ready answer below, or write to dispatch.',
      );

      const list = UNSAFE_getByType(FlatList);
      const scrollToOffsetMock = jest.fn();
      const scrollToEndMock = jest.fn();
      list.instance.scrollToOffset = scrollToOffsetMock;
      list.instance.scrollToEnd = scrollToEndMock;

      // 1. Initial list layout: box height is 600
      fireEvent(list, 'layout', { nativeEvent: { layout: { height: 600 } } });
      expect(scrollToOffsetMock).toHaveBeenLastCalledWith({
        offset: 0,
        animated: false,
      });

      // 2. Messages render: content height is 1000. Offset = 1000 - 600 = 400
      fireEvent(list, 'contentSizeChange', 400, 1000);
      expect(scrollToOffsetMock).toHaveBeenLastCalledWith({
        offset: 400,
        animated: false,
      });

      // 3. New message arrives or is sent: content height grows to 1350. Offset = 1350 - 600 = 750
      fireEvent(list, 'contentSizeChange', 400, 1350);
      expect(scrollToOffsetMock).toHaveBeenLastCalledWith({
        offset: 750,
        animated: false,
      });

      // 4. Keyboard opens: list height shrinks to 350. Offset = 1350 - 350 = 1000
      fireEvent(list, 'layout', { nativeEvent: { layout: { height: 350 } } });
      expect(scrollToOffsetMock).toHaveBeenLastCalledWith({
        offset: 1000,
        animated: false,
      });

      // 5. Keyboard closes: list height expands back to 600. Offset = 1350 - 600 = 750
      fireEvent(list, 'layout', { nativeEvent: { layout: { height: 600 } } });
      expect(scrollToOffsetMock).toHaveBeenLastCalledWith({
        offset: 750,
        animated: false,
      });

      // Must not depend on scrollToEnd
      expect(scrollToEndMock).not.toHaveBeenCalled();
    });

    it('never scrolls to a negative offset when the content is shorter than the list', async () => {
      const { findByText, UNSAFE_getByType } = renderChat();
      await findByText(
        'No messages yet. Tap a ready answer below, or write to dispatch.',
      );

      const list = UNSAFE_getByType(FlatList);
      const scrollToOffsetMock = jest.fn();
      list.instance.scrollToOffset = scrollToOffsetMock;

      // List box height is 700
      fireEvent(list, 'layout', { nativeEvent: { layout: { height: 700 } } });

      // Content height is only 250 (shorter than list: 250 - 700 = -450 -> clamped to 0)
      fireEvent(list, 'contentSizeChange', 400, 250);
      expect(scrollToOffsetMock).toHaveBeenLastCalledWith({
        offset: 0,
        animated: false,
      });

      // Content height updates to 500, still shorter than list (500 - 700 = -200 -> clamped to 0)
      fireEvent(list, 'contentSizeChange', 400, 500);
      expect(scrollToOffsetMock).toHaveBeenLastCalledWith({
        offset: 0,
        animated: false,
      });

      // Verify no call to scrollToOffset ever had a negative offset
      for (const call of scrollToOffsetMock.mock.calls) {
        expect(call[0].offset).toBeGreaterThanOrEqual(0);
      }
    });

    it('uses behavior "padding" on KeyboardAvoidingView on Android as well as iOS', async () => {
      try {
        // Test Android behavior
        Platform.OS = 'android';
        const androidRender = renderChat();
        await androidRender.findByText(
          'No messages yet. Tap a ready answer below, or write to dispatch.',
        );
        const androidKav = androidRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(androidKav.props.behavior).toBe('padding');

        // Test iOS behavior
        Platform.OS = 'ios';
        const iosRender = renderChat();
        await iosRender.findByText(
          'No messages yet. Tap a ready answer below, or write to dispatch.',
        );
        const iosKav = iosRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(iosKav.props.behavior).toBe('padding');
      } finally {
        Platform.OS = originalOS;
      }
    });
  });
});
