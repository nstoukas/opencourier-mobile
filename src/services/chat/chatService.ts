import { UClient } from '../Client';
import { currentLanguage } from '@app/localization/appLanguage';

// Spec 0034 (chat). The rider's one conversation with the co-op's dispatch, on the backend's
// `courier/v1/chat` routes. The server finds the thread from the login: there is no thread id here.

export type ChatSenderKind = 'DISPATCH' | 'COURIER' | 'PARTNER' | 'SYSTEM';

export type ChatMessage = {
  id: string;
  senderKind: ChatSenderKind;
  // "Dispatch" on dispatch's messages (AC-5), never a person's name; null on the rider's own and on
  // a system line.
  senderName: string | null;
  body: string;
  deliveryId: string | null;
  orderReference: string | null;
  // On the rider's own messages only: the id the phone gave it, so a retried send matches (AC-19).
  clientMessageId?: string;
  createdAt: string;
  // On the rider's own messages only: true once any dispatcher opened the thread after it (AC-6).
  readByDispatch?: boolean;
};

// The live connection's CHAT_MESSAGE carries `{ message }`, the same shape as one of getMessages'
// messages. True when that message is from dispatch; anything malformed counts as not.
export const isFromDispatch = (event: unknown): boolean => {
  const message = (event as { message?: { senderKind?: unknown } } | null)
    ?.message;
  return message?.senderKind === 'DISPATCH';
};

export type ChatSendInput = {
  body: string;
  deliveryId?: string | null;
  clientMessageId: string;
};

export type ChatService = {
  getMessages: (page?: {
    before?: string;
    after?: string;
  }) => Promise<ChatMessage[]>;
  sendMessage: (input: ChatSendInput) => Promise<ChatMessage>;
  getQuickReplies: () => Promise<string[]>;
};

const chatService = (client: UClient): ChatService => ({
  getMessages: async (page = {}) => {
    const { data } = await client.get('chat/messages', { params: page });
    return data.result.messages;
  },
  sendMessage: async input => {
    const { data } = await client.post('chat/messages', input);
    return data.result;
  },
  getQuickReplies: async () => {
    const { data } = await client.get('chat/quick-replies');
    // Spec 0054 (AC-7): each preset in both languages; the one on show now, else the other. An older
    // server sends only `replies` (texts in one language).
    const presets: unknown = data.result.presets;
    if (Array.isArray(presets)) {
      const language = currentLanguage();
      return presets
        .map((preset: { el?: string; en?: string }) =>
          language === 'el'
            ? preset.el || preset.en || ''
            : preset.en || preset.el || '',
        )
        .filter(text => text !== '');
    }
    return data.result.replies;
  },
});

export default chatService;
