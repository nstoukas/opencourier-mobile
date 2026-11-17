import { services } from './service';
import * as chatSeenModule from './chat/chatSeen';

jest.mock('./chat/chatSeen', () => ({
  clearChatSeen: jest.fn().mockResolvedValue(undefined),
}));

describe('Services.logout clears chat seen (spec 0034, AC-12, Services.ts)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('services.logout() calls clearChatSeen()', async () => {
    services.logout();
    expect(chatSeenModule.clearChatSeen).toHaveBeenCalledTimes(1);
  });
});
