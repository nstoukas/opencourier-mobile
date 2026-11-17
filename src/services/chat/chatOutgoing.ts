import { useSyncExternalStore } from 'react';
import type { ChatMessage } from './chatService';

// Spec 0034 (chat), AC-19: the messages the rider wrote that the server has not confirmed yet, or that
// failed. They live here, outside the Chat screen, so a send still on its way or a failed one is still
// there when the rider goes back to the job and opens Chat again (review of 2026-11-18). Memory only,
// never AsyncStorage: a chat line is not a record anyone's pay depends on (spec 0034, Decision).
// Cleared at logout and when a session ends.

// A message the rider wrote that the server has not confirmed, or that failed.
export type OutgoingChat = {
  clientMessageId: string;
  body: string;
  // The delivery it is about. Set to null when the server refused the tag (the rider no longer holds
  // that delivery), so a retry sends the message without it.
  deliveryId: string | null;
  state: 'sending' | 'failed';
  // The server's own sentence when it refused the message (a 4xx), shown under it.
  refusal?: string;
  // True once the server refused the delivery tag: the retry says it goes without the order.
  tagDropped?: boolean;
};

let outgoing: OutgoingChat[] = [];
const listeners = new Set<() => void>();

const setOutgoing = (next: OutgoingChat[]) => {
  outgoing = next;
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getOutgoing = (): OutgoingChat[] => outgoing;

// The list, kept up to date in any screen that reads it.
export const useChatOutgoing = (): OutgoingChat[] =>
  useSyncExternalStore(subscribe, getOutgoing);

export const addOutgoing = (item: OutgoingChat): void => {
  setOutgoing([...outgoing, item]);
};

// `Partial<OutgoingChat>` means "some of OutgoingChat's fields": only those given are changed.
export const updateOutgoing = (
  clientMessageId: string,
  changes: Partial<OutgoingChat>,
): void => {
  setOutgoing(
    outgoing.map(entry =>
      entry.clientMessageId === clientMessageId
        ? { ...entry, ...changes }
        : entry,
    ),
  );
};

export const removeOutgoing = (clientMessageId: string): void => {
  setOutgoing(
    outgoing.filter(entry => entry.clientMessageId !== clientMessageId),
  );
};

// The server already has these (a send whose answer was lost arrives with the next fetch): they are no
// longer outgoing, whatever they said before.
export const dropStoredOutgoing = (messages: ChatMessage[] | undefined) => {
  const stored = new Set(
    (messages ?? []).map(message => message.clientMessageId),
  );
  if (outgoing.some(entry => stored.has(entry.clientMessageId))) {
    setOutgoing(outgoing.filter(entry => !stored.has(entry.clientMessageId)));
  }
};

// At logout and session end: the next rider on this phone never sees the last one's unsent lines.
export const clearChatOutgoing = (): void => {
  setOutgoing([]);
};
