import AsyncStorage from '@react-native-async-storage/async-storage';
import { endExpiredSession } from './session';
import { clearReviewSeen } from './reviewSeen';
import { clearReviewNotice } from './reviewNotice';
import { queryClient } from './queryClient';

jest.mock('./reviewSeen', () => ({
  clearReviewSeen: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./reviewNotice', () => ({
  clearReviewNotice: jest.fn(),
}));

jest.mock('./offerPush/offerAlert', () => ({
  cancelAllOfferAlerts: jest.fn().mockResolvedValue(undefined),
}));

describe('endExpiredSession clears review seen and notice (spec 0038, Minor 1, session.ts)', () => {
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

  it('calls clearReviewSeen and clearReviewNotice when endExpiredSession runs', async () => {
    await endExpiredSession(mockHttp);
    expect(clearReviewSeen).toHaveBeenCalledTimes(1);
    expect(clearReviewNotice).toHaveBeenCalledTimes(1);
  });
});
