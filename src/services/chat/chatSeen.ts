import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage } from './chatService';

// Spec 0034 (chat), AC-12: whether the rider has a message from dispatch they have not seen is worked
// out on the phone, from the newest dispatch message they had on screen. The server never learns it,
// so dispatch can never see whether a rider read something (AC-6). Both Chat dots read this one key.
export const CHAT_SEEN_KEY = 'chat_last_seen_message';

type Seen = { id: string; createdAt: string };

let cached: Seen | null | undefined;
const listeners = new Set<() => void>();

export async function loadChatSeen(): Promise<Seen | null> {
  if (cached !== undefined) {
    return cached;
  }
  try {
    const raw = await AsyncStorage.getItem(CHAT_SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Seen>) : null;
    cached =
      parsed &&
      typeof parsed.id === 'string' &&
      typeof parsed.createdAt === 'string'
        ? { id: parsed.id, createdAt: parsed.createdAt }
        : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function chatSeenNow(): Seen | null {
  return cached ?? null;
}

export function subscribeChatSeen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach(listener => listener());
}

// The newest message from dispatch in a list, or null when there is none.
export function newestFromDispatch(
  messages: ChatMessage[] | undefined,
): ChatMessage | null {
  let newest: ChatMessage | null = null;
  for (const message of messages ?? []) {
    if (
      message.senderKind === 'DISPATCH' &&
      (!newest || message.createdAt > newest.createdAt)
    ) {
      newest = message;
    }
  }
  return newest;
}

// True when dispatch wrote something newer than what the rider last had on screen.
export function hasUnseenFromDispatch(
  messages: ChatMessage[] | undefined,
  seen: Seen | null,
): boolean {
  const newest = newestFromDispatch(messages);
  if (!newest) {
    return false;
  }
  return !seen || (newest.id !== seen.id && newest.createdAt > seen.createdAt);
}

// The chat screen was open with these messages: everything from dispatch in them is seen.
export async function markChatSeen(
  messages: ChatMessage[] | undefined,
): Promise<void> {
  const newest = newestFromDispatch(messages);
  if (!newest) {
    return;
  }
  const current = await loadChatSeen();
  if (current && current.createdAt >= newest.createdAt) {
    return;
  }
  cached = { id: newest.id, createdAt: newest.createdAt };
  notify();
  await AsyncStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(cached)).catch(
    () => undefined,
  );
}

// At logout and session end: the next rider on this phone starts with nothing seen.
export async function clearChatSeen(): Promise<void> {
  cached = null;
  notify();
  await AsyncStorage.removeItem(CHAT_SEEN_KEY).catch(() => undefined);
}

// Tests only: forget the in memory copy.
export function resetChatSeenCacheForTests(): void {
  cached = undefined;
}
