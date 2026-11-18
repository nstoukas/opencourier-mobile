import AsyncStorage from '@react-native-async-storage/async-storage';
import { endExpiredSession } from './session';
import { clearChatSeen } from './chat/chatSeen';
import { clearChatNotice } from './chat/chatNotice';
import { clearChatOutgoing } from './chat/chatOutgoing';
import { queryClient } from './queryClient';

jest.mock('./chat/chatSeen', () => ({
  clearChatSeen: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./chat/chatNotice', () => ({
  clearChatNotice: jest.fn(),
}));

jest.mock('./chat/chatOutgoing', () => ({
  clearChatOutgoing: jest.fn(),
}));

jest.mock('./offerPush/offerAlert', () => ({
  cancelAllOfferAlerts: jest.fn().mockResolvedValue(undefined),
}));

describe('endExpiredSession clears chat seen, notice, and outgoing (spec 0034, Minor 7, session.ts)', () => {
  let mockHttp: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockHttp = jest.fn() as any;
    mockHttp.defaults = {
      headers: {
        common: {} as Record<string, string | undefined>,
      },
    };
    jest
      .spyOn(queryClient, 'resetQueries')
      .mockImplementation(() => Promise.resolve());
  });

  it('calls clearChatSeen, clearChatNotice, and clearChatOutgoing when endExpiredSession runs', async () => {
    await endExpiredSession(mockHttp);
    expect(clearChatSeen).toHaveBeenCalledTimes(1);
    expect(clearChatNotice).toHaveBeenCalledTimes(1);
    expect(clearChatOutgoing).toHaveBeenCalledTimes(1);
  });
});
