import AsyncStorage from '@react-native-async-storage/async-storage';
import { endExpiredSession } from './session';
import { clearRemovalNotices } from './removalNotice/removalNotice';
import { queryClient } from './queryClient';

jest.mock('./removalNotice/removalNotice', () => ({
  clearRemovalNotices: jest.fn(),
}));

jest.mock('./offerPush/offerAlert', () => ({
  cancelAllOfferAlerts: jest.fn().mockResolvedValue(undefined),
}));

describe('session end clears removal notices (spec 0035, session.ts)', () => {
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

  it('calls clearRemovalNotices when endExpiredSession runs', async () => {
    await endExpiredSession(mockHttp);

    expect(clearRemovalNotices).toHaveBeenCalledTimes(1);
  });
});
