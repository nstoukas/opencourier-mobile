import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '@app/services/service';
import type { ChatMessage } from '@app/services/chat/chatService';
import {
  chatSeenNow,
  hasUnseenFromDispatch,
  loadChatSeen,
  subscribeChatSeen,
} from '@app/services/chat/chatSeen';
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

// A message the rider wrote that the server has not confirmed, or that failed (AC-19).
export type OutgoingChat = {
  clientMessageId: string;
  body: string;
  deliveryId: string | null;
  state: 'sending' | 'failed';
};

const newClientMessageId = (): string =>
  `rider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Sending, with retries that keep their clientMessageId so a retry never makes a second message
// (AC-19). Failed sends stay in memory only, never in the job step outbox: a chat line is not a
// record anyone's pay depends on (spec 0034, Decision).
export const useChatSender = () => {
  const queryClient = useQueryClient();
  const [outgoing, setOutgoing] = useState<OutgoingChat[]>([]);

  const deliver = useCallback(
    async (item: OutgoingChat) => {
      setOutgoing(list =>
        list.map(entry =>
          entry.clientMessageId === item.clientMessageId
            ? { ...entry, state: 'sending' }
            : entry,
        ),
      );
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
        setOutgoing(list =>
          list.filter(entry => entry.clientMessageId !== item.clientMessageId),
        );
        queryClient.invalidateQueries({ queryKey: [QueryKeys.chatMessages] });
      } catch {
        setOutgoing(list =>
          list.map(entry =>
            entry.clientMessageId === item.clientMessageId
              ? { ...entry, state: 'failed' }
              : entry,
          ),
        );
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
      setOutgoing(list => [...list, item]);
      deliver(item);
      return true;
    },
    [deliver],
  );

  return { outgoing, send, retry: deliver };
};
