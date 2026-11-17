import AsyncStorage from '@react-native-async-storage/async-storage';
import { endExpiredSession } from './session';
import { clearChatSeen } from './chat/chatSeen';
import { queryClient } from './queryClient';

jest.mock('./chat/chatSeen', () => ({
  clearChatSeen: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./offerPush/offerAlert', () => ({
  cancelAllOfferAlerts: jest.fn().mockResolvedValue(undefined),
}));

describe('endExpiredSession clears chat seen (spec 0034, AC-12, session.ts)', () => {
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

  it('calls clearChatSeen when endExpiredSession runs', async () => {
    await endExpiredSession(mockHttp);
    expect(clearChatSeen).toHaveBeenCalledTimes(1);
  });
});
