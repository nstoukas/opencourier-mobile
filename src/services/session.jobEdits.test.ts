import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearRiderDataOnPhone } from './session';
import {
  clearJobEditMarks,
  jobEditMarksFor,
  markJobEdited,
} from './jobEdits/jobEditMarks';
import {
  clearJobEditedNotices,
  resetJobEditedNoticeForTests,
} from './readyNotice/readyNotice';
import notifee from '@notifee/react-native';
import { queryClient } from './queryClient';

jest.mock('./readyNotice/readyNotice', () => {
  const actual = jest.requireActual('./readyNotice/readyNotice');
  return {
    ...actual,
    clearJobEditedNotices: jest.fn(actual.clearJobEditedNotices),
  };
});

jest.mock('./offerPush/offerAlert', () => ({
  cancelAllOfferAlerts: jest.fn().mockResolvedValue(undefined),
}));

// Row 164 (AC-6): clearRiderDataOnPhone clears job edit marks and cancels job edited notices.
describe('clearRiderDataOnPhone job edits (row 164, AC-6)', () => {
  let mockHttp: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    clearJobEditMarks();
    resetJobEditedNoticeForTests();
    await AsyncStorage.clear();
    mockHttp = {
      defaults: {
        headers: {
          common: {} as Record<string, string | undefined>,
        },
      },
    };
    jest
      .spyOn(queryClient, 'resetQueries')
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    clearJobEditMarks();
    resetJobEditedNoticeForTests();
  });

  it('clearRiderDataOnPhone calls clearJobEditMarks and clearJobEditedNotices', async () => {
    markJobEdited({
      deliveryId: 'del-session-1',
      restaurantName: 'R73 Kitchen',
      changed: ['TIMES'],
      editedAt: '2026-11-25T14:00:00.000Z',
    });
    expect(jobEditMarksFor('del-session-1')).toEqual(['TIMES']);

    (notifee.getDisplayedNotifications as jest.Mock).mockResolvedValue([
      { id: 'edited-del-session-1' },
      { id: 'ready-del-1' },
    ]);

    await clearRiderDataOnPhone(mockHttp);

    // 1. Marks cleared
    expect(jobEditMarksFor('del-session-1')).toEqual([]);

    // 2. clearJobEditedNotices called and cancels edited-del-session-1
    expect(clearJobEditedNotices).toHaveBeenCalledTimes(1);
    expect(notifee.cancelNotification).toHaveBeenCalledWith('edited-del-session-1');
    expect(notifee.cancelNotification).not.toHaveBeenCalledWith('ready-del-1');
  });
});
