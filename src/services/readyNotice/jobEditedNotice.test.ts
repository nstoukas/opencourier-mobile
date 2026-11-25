import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
} from '@notifee/react-native';
import i18n from '@app/localization/i18n';
import { JobEdited, parseJobEdited } from '@app/utilities/jobEdits';
import {
  READY_CHANNEL_ID,
  clearJobEditedNotices,
  resetJobEditedNoticeForTests,
  showJobEditedNotice,
} from './readyNotice';

// Row 164 (AC-3, AC-6): showJobEditedNotice posts on the ready channel with id edited-<deliveryId>,
// dedupes live and push copies sharing editedAt, escapes Android body, and clears on logout.
describe('showJobEditedNotice (row 164, AC-3)', () => {
  const originalOS = Platform.OS;

  const baseUpdate: JobEdited = {
    deliveryId: 'del-notice-1',
    restaurantName: 'R73 Kitchen',
    changed: ['NOTES', 'TIMES'],
    editedAt: '2026-11-25T14:30:00.000Z',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    resetJobEditedNoticeForTests();
    Platform.OS = 'android';
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    Platform.OS = originalOS;
    resetJobEditedNoticeForTests();
  });

  const postedCount = () =>
    (notifee.displayNotification as jest.Mock).mock.calls.length;

  it('posts with id edited-<deliveryId> on READY_CHANNEL_ID with high importance and default sound', async () => {
    await showJobEditedNotice(baseUpdate);

    expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    expect(notifee.displayNotification).toHaveBeenCalledWith({
      id: 'edited-del-notice-1',
      title: 'Job changed',
      body: 'R73 Kitchen: notes, times',
      android: {
        channelId: READY_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
      ios: { sound: 'default' },
    });
  });

  it('posts in Greek when language is el ("Αλλαγή στην παραγγελία" / "σημειώσεις, ώρες")', async () => {
    await i18n.changeLanguage('el');

    await showJobEditedNotice(baseUpdate);

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'edited-del-notice-1',
        title: 'Αλλαγή στην παραγγελία',
        body: 'R73 Kitchen: σημειώσεις, ώρες',
      }),
    );
  });

  it('HTML escapes restaurant name on Android', async () => {
    Platform.OS = 'android';
    await showJobEditedNotice({
      ...baseUpdate,
      restaurantName: 'Fish & Chips <Hot>',
    });

    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Fish &amp; Chips &lt;Hot&gt;: notes, times',
      }),
    );
  });

  it('leaves body unescaped on iOS and does not create an Android channel there', async () => {
    Platform.OS = 'ios';
    await showJobEditedNotice({
      ...baseUpdate,
      restaurantName: 'Fish & Chips <Hot>',
    });

    expect(notifee.createChannel).not.toHaveBeenCalled();
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Fish & Chips <Hot>: notes, times',
      }),
    );
  });

  describe('deduplication between live message and push', () => {
    it('live and push copies of one edit (same editedAt and changed) post only once', async () => {
      await showJobEditedNotice(baseUpdate);
      await showJobEditedNotice(baseUpdate);

      expect(postedCount()).toBe(1);
    });

    it('live and push arriving together under Promise.all post only once', async () => {
      const live = parseJobEdited({
        deliveryId: 'del-notice-1',
        restaurantName: 'R73 Kitchen',
        changed: ['NOTES', 'TIMES'],
        editedAt: '2026-11-25T14:30:00.000Z',
      });
      const push = parseJobEdited({
        type: 'JOB_EDITED',
        deliveryId: 'del-notice-1',
        restaurantName: 'R73 Kitchen',
        changed: 'NOTES,TIMES',
        editedAt: '2026-11-25T14:30:00.000Z',
      });

      await Promise.all([
        showJobEditedNotice(live!),
        showJobEditedNotice(push!),
      ]);

      expect(postedCount()).toBe(1);
    });

    it('a later edit for the same delivery with different editedAt posts again and reuses the id', async () => {
      await showJobEditedNotice(baseUpdate);

      const laterUpdate: JobEdited = {
        ...baseUpdate,
        editedAt: '2026-11-25T14:35:00.000Z',
        changed: ['TIMES'],
      };
      await showJobEditedNotice(laterUpdate);

      expect(postedCount()).toBe(2);
      const callIds = (notifee.displayNotification as jest.Mock).mock.calls.map(
        ([n]) => n.id,
      );
      expect(callIds).toEqual(['edited-del-notice-1', 'edited-del-notice-1']);
      expect(notifee.displayNotification).toHaveBeenLastCalledWith(
        expect.objectContaining({
          body: 'R73 Kitchen: times',
        }),
      );
    });

    it('a different delivery is independent and posts its own notification', async () => {
      await showJobEditedNotice(baseUpdate);
      await showJobEditedNotice({
        ...baseUpdate,
        deliveryId: 'del-notice-2',
      });

      expect(postedCount()).toBe(2);
      const callIds = (notifee.displayNotification as jest.Mock).mock.calls.map(
        ([n]) => n.id,
      );
      expect(callIds).toEqual(['edited-del-notice-1', 'edited-del-notice-2']);
    });

    it('when displayNotification rejects, the mark is restored so a retry can post', async () => {
      (notifee.displayNotification as jest.Mock).mockRejectedValueOnce(
        new Error('permission denied'),
      );

      // The first attempt fails and rejects to the caller
      await expect(showJobEditedNotice(baseUpdate)).rejects.toThrow(
        'permission denied',
      );

      // The mark was given back on rejection, so a retry of the same change posts
      await showJobEditedNotice(baseUpdate);
      const callIds = (notifee.displayNotification as jest.Mock).mock.calls.map(
        ([n]) => n.id,
      );
      expect(callIds).toEqual(['edited-del-notice-1', 'edited-del-notice-1']);
      expect(postedCount()).toBe(2);

      // Once that copy posted, a further attempt is treated as a duplicate and blocked
      await showJobEditedNotice(baseUpdate);
      expect(postedCount()).toBe(2);
    });

    it('failed post does not wipe mark if a newer change for the same delivery arrived meanwhile', async () => {
      let rejectFirst!: (err: Error) => void;
      const firstDeferred = new Promise((_, reject) => {
        rejectFirst = reject;
      });

      (notifee.displayNotification as jest.Mock).mockImplementationOnce(
        () => firstDeferred,
      );

      // 1. The first change starts posting and records its mark
      const firstPromise = showJobEditedNotice(baseUpdate);

      // 2. Meanwhile, a newer change for the same delivery arrives and posts successfully
      const newerUpdate: JobEdited = {
        ...baseUpdate,
        editedAt: '2026-11-25T14:40:00.000Z',
        changed: ['NOTES'],
      };
      await showJobEditedNotice(newerUpdate);
      expect(postedCount()).toBe(2);

      // 3. First post now fails
      rejectFirst(new Error('display failed'));
      await expect(firstPromise).rejects.toThrow('display failed');

      // 4. Duplicate copy of newerUpdate arrives: its mark was not wiped by the first post's failure
      await showJobEditedNotice(newerUpdate);
      expect(postedCount()).toBe(2);
    });

    it('resetJobEditedNoticeForTests resets the dedupe map', async () => {
      await showJobEditedNotice(baseUpdate);
      expect(postedCount()).toBe(1);

      resetJobEditedNoticeForTests();

      await showJobEditedNotice(baseUpdate);
      expect(postedCount()).toBe(2);
    });
  });
});

describe('clearJobEditedNotices (row 164, AC-6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetJobEditedNoticeForTests();
  });

  it('cancels only notifications starting with edited-', async () => {
    (notifee.getDisplayedNotifications as jest.Mock).mockResolvedValue([
      { id: 'edited-del-1' },
      { id: 'ready-del-1' },
      { id: 'edited-del-2' },
      { id: 'removal-del-3' },
    ]);

    await clearJobEditedNotices();

    expect(notifee.cancelNotification).toHaveBeenCalledTimes(2);
    expect(notifee.cancelNotification).toHaveBeenCalledWith('edited-del-1');
    expect(notifee.cancelNotification).toHaveBeenCalledWith('edited-del-2');
  });

  it('clears lastEdited dedupe map so previous notices can post again after clear', async () => {
    (notifee.getDisplayedNotifications as jest.Mock).mockResolvedValue([]);
    const update: JobEdited = {
      deliveryId: 'del-1',
      restaurantName: 'Kitchen',
      changed: ['NOTES'],
      editedAt: '2026-11-25T14:30:00.000Z',
    };

    await showJobEditedNotice(update);
    expect(notifee.displayNotification).toHaveBeenCalledTimes(1);

    await clearJobEditedNotices();

    await showJobEditedNotice(update);
    expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
  });

  it('never throws even when notifee throws an error', async () => {
    (notifee.getDisplayedNotifications as jest.Mock).mockRejectedValue(
      new Error('notifee error'),
    );

    await expect(clearJobEditedNotices()).resolves.toBeUndefined();
  });
});
