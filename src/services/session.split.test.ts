import AsyncStorage from '@react-native-async-storage/async-storage';
import { endExpiredSession } from './session';
import { clearSplitNotices } from './splitNotice/splitNotice';
import { queryClient } from './queryClient';

jest.mock('./splitNotice/splitNotice', () => ({
  clearSplitNotices: jest.fn(),
}));

jest.mock('./offerPush/offerAlert', () => ({
  cancelAllOfferAlerts: jest.fn().mockResolvedValue(undefined),
}));

// Row 11 review: a session that ends by itself clears the last rider's split answers, as logout does.
describe('session end clears split notices (spec 0047, session.ts)', () => {
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

  it('calls clearSplitNotices when endExpiredSession runs', async () => {
    await endExpiredSession(mockHttp);

    expect(clearSplitNotices).toHaveBeenCalledTimes(1);
  });
});
