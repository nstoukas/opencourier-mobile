import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearRiderDataOnPhone, endExpiredSession } from './session';
import { clearComplaintNotice } from './complaintNotice';
import { clearPickedPhotoFiles } from './complaintPhotoFiles';
import { services } from './service';
import { queryClient } from './queryClient';

jest.mock('./complaintNotice', () => ({
  clearComplaintNotice: jest.fn(),
}));

jest.mock('./complaintPhotoFiles', () => ({
  clearPickedPhotoFiles: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./reviewNotice', () => ({
  clearReviewNotice: jest.fn(),
}));

jest.mock('./reviewSeen', () => ({
  clearReviewSeen: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./chat/chatNotice', () => ({
  clearChatNotice: jest.fn(),
}));

jest.mock('./chat/chatSeen', () => ({
  clearChatSeen: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./chat/chatOutgoing', () => ({
  clearChatOutgoing: jest.fn(),
}));

jest.mock('./statements/statementsApi', () => ({
  clearStatementFiles: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./offerPush/offerAlert', () => ({
  cancelAllOfferAlerts: jest.fn().mockResolvedValue(undefined),
}));

describe('Complaints notice clearing on logout and session expiration (spec 0052, AC-4, session.ts, Services.ts)', () => {
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

  it('clearRiderDataOnPhone calls clearComplaintNotice and clearPickedPhotoFiles', async () => {
    await clearRiderDataOnPhone(mockHttp);
    expect(clearComplaintNotice).toHaveBeenCalledTimes(1);
    expect(clearPickedPhotoFiles).toHaveBeenCalledTimes(1);
  });

  it('endExpiredSession (which invokes clearRiderDataOnPhone) calls clearComplaintNotice and clearPickedPhotoFiles', async () => {
    await endExpiredSession(mockHttp);
    expect(clearComplaintNotice).toHaveBeenCalledTimes(1);
    expect(clearPickedPhotoFiles).toHaveBeenCalledTimes(1);
  });

  it('services.logout() calls clearComplaintNotice and clearPickedPhotoFiles', () => {
    services.logout();
    expect(clearComplaintNotice).toHaveBeenCalledTimes(1);
    expect(clearPickedPhotoFiles).toHaveBeenCalledTimes(1);
  });
});
