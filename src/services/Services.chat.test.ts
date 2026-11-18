import { services } from './service';
import * as chatSeenModule from './chat/chatSeen';
import * as chatNoticeModule from './chat/chatNotice';
import * as chatOutgoingModule from './chat/chatOutgoing';

jest.mock('./chat/chatSeen', () => ({
  clearChatSeen: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./chat/chatNotice', () => ({
  clearChatNotice: jest.fn(),
}));

jest.mock('./chat/chatOutgoing', () => ({
  clearChatOutgoing: jest.fn(),
}));

describe('Services.logout clears chat seen, notice, and outgoing (spec 0034, Minor 7, Services.ts)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('services.logout() calls clearChatSeen(), clearChatNotice(), and clearChatOutgoing()', async () => {
    services.logout();
    expect(chatSeenModule.clearChatSeen).toHaveBeenCalledTimes(1);
    expect(chatNoticeModule.clearChatNotice).toHaveBeenCalledTimes(1);
    expect(chatOutgoingModule.clearChatOutgoing).toHaveBeenCalledTimes(1);
  });
});
