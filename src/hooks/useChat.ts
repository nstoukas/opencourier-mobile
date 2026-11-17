import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { services } from '@app/services/service';
import type { ChatMessage } from '@app/services/chat/chatService';
import {
  chatSeenNow,
  hasUnseenFromDispatch,
  loadChatSeen,
  subscribeChatSeen,
} from '@app/services/chat/chatSeen';
import {
  addOutgoing,
  type OutgoingChat,
  removeOutgoing,
  updateOutgoing,
  useChatOutgoing,
} from '@app/services/chat/chatOutgoing';
import { serverMessage } from '@app/hooks/useMoveDropoffPin';
import { QueryKeys } from '@app/utilities/queryKeys';

// Spec 0034 (chat), AC-8: with no live connection (a rider Offline with no job, or no signal), an open
// chat screen asks again this often.
export const CHAT_POLL_MS = 10_000;

// A message is 1 to 1000 characters after trimming (AC-4).
export const CHAT_MESSAGE_MAX_LENGTH = 1000;

// The rider's messages with dispatch, newest 50, oldest first. `poll` is for the open chat screen only.
export const useChatMessages = (
  options: { enabled?: boolean; poll?: boolean } = {},
) =>
  useQuery({
    queryKey: [QueryKeys.chatMessages],
    queryFn: () => services.chatService.getMessages(),
    enabled: options.enabled ?? true,
    // Every time a screen showing the chat appears, it asks the server (AC-8).
    refetchOnMount: 'always',
    refetchInterval: options.poll ? CHAT_POLL_MS : false,
  });

// The co-op's one tap presets for riders (AC-13).
export const useChatQuickReplies = () =>
  useQuery({
    queryKey: [QueryKeys.chatQuickReplies],
    queryFn: () => services.chatService.getQuickReplies(),
    staleTime: 5 * 60_000,
  });

// AC-12: the unread dot, worked out on the phone from the last dispatch message seen on screen.
// Shared by the Chat action on the job and the Chat entry in the side menu.
export const useChatUnseen = (): boolean => {
  const { data } = useChatMessages();
  const [, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    loadChatSeen().then(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);
  const seen = useSyncExternalStore(subscribeChatSeen, chatSeenNow);
  return hasUnseenFromDispatch(data, seen);
};

// Kept outside the screen (chatOutgoing.ts), so leaving Chat does not lose them (AC-19).
export type { OutgoingChat };

const newClientMessageId = (): string =>
  `rider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Sending, with retries that keep their clientMessageId so a retry never makes a second message
// (AC-19). Failed sends stay in memory only, never in the job step outbox: a chat line is not a
// record anyone's pay depends on (spec 0034, Decision).
export const useChatSender = () => {
  const queryClient = useQueryClient();
  const outgoing = useChatOutgoing();

  const deliver = useCallback(
    async (item: OutgoingChat) => {
      updateOutgoing(item.clientMessageId, {
        state: 'sending',
        refusal: undefined,
      });
      try {
        const saved = await services.chatService.sendMessage({
          body: item.body,
          deliveryId: item.deliveryId,
          clientMessageId: item.clientMessageId,
        });
        // The stored message joins the list at once, then the list is asked again.
        queryClient.setQueryData<ChatMessage[]>(
          [QueryKeys.chatMessages],
          list =>
            list?.some(message => message.id === saved.id)
              ? list
              : [...(list ?? []), saved],
        );
        removeOutgoing(item.clientMessageId);
        queryClient.invalidateQueries({ queryKey: [QueryKeys.chatMessages] });
      } catch (error) {
        // A 404 on a tagged message means the rider no longer holds that delivery (the thread itself
        // comes from the login and cannot be missing): the retry goes out without the tag.
        const tagRefused =
          item.deliveryId !== null &&
          axios.isAxiosError(error) &&
          error.response?.status === 404;
        updateOutgoing(item.clientMessageId, {
          state: 'failed',
          // The server's own sentence for a refusal (a 4xx); none for no signal or a server error.
          refusal: serverMessage(error),
          // `...(a ? b : {})` adds b's fields only when a is true.
          ...(tagRefused ? { deliveryId: null, tagDropped: true } : {}),
        });
      }
    },
    [queryClient],
  );

  // Returns false when there is nothing to send (blank, or over 1000 characters).
  const send = useCallback(
    (text: string, deliveryId: string | null): boolean => {
      const body = text.trim();
      if (body.length === 0 || body.length > CHAT_MESSAGE_MAX_LENGTH) {
        return false;
      }
      const item: OutgoingChat = {
        clientMessageId: newClientMessageId(),
        body,
        deliveryId,
        state: 'sending',
      };
      addOutgoing(item);
      deliver(item);
      return true;
    },
    [deliver],
  );

  return { outgoing, send, retry: deliver };
};
