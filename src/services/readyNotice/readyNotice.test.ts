import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import '@app/localization/i18n';
import {
  JobReadyUpdate,
  parseJobReadyUpdate,
} from '@app/utilities/readySignals';
import {
  READY_CHANNEL_ID,
  resetReadyNoticeForTests,
  showReadyNotice,
} from './readyNotice';

// Spec 0023 (AC-6): the notice a rider gets when the restaurant moves the
// ready time or marks the food ready.
describe('showReadyNotice (spec 0023, AC-6)', () => {
  const originalOS = Platform.OS;
  const NOW = Date.parse('2026-11-03T12:00:00.000Z');

  const delay: JobReadyUpdate = {
    deliveryId: 'del-1',
    restaurantName: 'R73 Kitchen',
    readyAt: new Date(NOW + 12 * 60 * 1000).toISOString(),
    foodReadyAt: null,
    delayMinutes: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // The notice remembers each job's last change (row 21 review); start each test with none.
    resetReadyNoticeForTests();
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("uses the job-ready channel, with the phone's default sound", async () => {
    expect(READY_CHANNEL_ID).toBe('job-ready');
    await showReadyNotice(delay, NOW);
    expect(notifee.createChannel).toHaveBeenCalledWith({
      id: 'job-ready',
      name: 'Ready times',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
    });
  });

  it('posts one notification with id ready-<deliveryId> on the job-ready channel, worded from the message', async () => {
    await showReadyNotice(delay, NOW);
    expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    expect(notifee.displayNotification).toHaveBeenCalledWith({
      id: 'ready-del-1',
      title: 'Food ready time',
      body: 'R73 Kitchen: +10 min, ready in ~12 min',
      android: {
        channelId: 'job-ready',
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
      // The phone's default sound on iOS too (row 21 review).
      ios: { sound: 'default' },
    });
  });

  it('says food ready for a food ready message', async () => {
    await showReadyNotice(
      {
        ...delay,
        foodReadyAt: '2026-11-03T11:59:00.000Z',
        delayMinutes: null,
      },
      NOW,
    );
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ready-del-1',
        body: 'R73 Kitchen: food ready',
      }),
    );
  });

  it('a second change for the same job reuses the same id, so it replaces the first', async () => {
    await showReadyNotice(delay, NOW);
    // A real second change: the ready time moves 5 min further.
    await showReadyNotice(
      {
        ...delay,
        readyAt: new Date(NOW + 17 * 60 * 1000).toISOString(),
        delayMinutes: 5,
      },
      NOW,
    );
    const ids = (notifee.displayNotification as jest.Mock).mock.calls.map(
      ([n]) => n.id,
    );
    expect(ids).toEqual(['ready-del-1', 'ready-del-1']);
  });

  it('escapes the restaurant name as HTML on Android', async () => {
    await showReadyNotice(
      {
        ...delay,
        restaurantName: 'Tom & Jerry <b>Grill</b>',
        foodReadyAt: '2026-11-03T11:59:00.000Z',
      },
      NOW,
    );
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Tom &amp; Jerry &lt;b&gt;Grill&lt;/b&gt;: food ready',
      }),
    );
  });

  it('leaves the body as plain text on iOS, and makes no Android channel there', async () => {
    Platform.OS = 'ios';
    await showReadyNotice(
      {
        ...delay,
        restaurantName: 'Tom & Jerry <b>Grill</b>',
        foodReadyAt: '2026-11-03T11:59:00.000Z',
      },
      NOW,
    );
    expect(notifee.createChannel).not.toHaveBeenCalled();
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ready-del-1',
        body: 'Tom & Jerry <b>Grill</b>: food ready',
      }),
    );
  });

  it("sets the iOS sound to the phone's default", async () => {
    Platform.OS = 'ios';
    await showReadyNotice(delay, NOW);
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({ ios: { sound: 'default' } }),
    );
  });

  // Row 21 review: the backend sends every change both over the live connection and by push, so
  // the same change can reach showReadyNotice twice; the rider is told once.
  describe('once per change', () => {
    const posted = () =>
      (notifee.displayNotification as jest.Mock).mock.calls.length;

    it('the same job with the same readyAt and foodReadyAt a second time posts nothing', async () => {
      await showReadyNotice(delay, NOW);
      await showReadyNotice(delay, NOW);
      expect(posted()).toBe(1);
      // The repeat makes no channel either: it stops before anything is posted.
      expect(notifee.createChannel).toHaveBeenCalledTimes(1);
    });

    it('the live message and the push for one change arriving together (Promise.all of showReadyNotice with both wire shapes) post one notification', async () => {
      const readyAt = '2026-11-03T12:12:00.000Z';
      // The live event carries typed values; the push carries text, '' for null.
      const live = parseJobReadyUpdate({
        deliveryId: 'del-1',
        restaurantName: 'R73 Kitchen',
        readyAt,
        foodReadyAt: null,
        delayMinutes: 10,
      });
      const push = parseJobReadyUpdate({
        type: 'JOB_READY_UPDATED',
        deliveryId: 'del-1',
        restaurantName: 'R73 Kitchen',
        readyAt,
        foodReadyAt: '',
        delayMinutes: '10',
      });
      await Promise.all([
        showReadyNotice(live!, NOW),
        showReadyNotice(push!, NOW),
      ]);
      expect(posted()).toBe(1);
    });

    it('a different readyAt for the same job posts again', async () => {
      await showReadyNotice(delay, NOW);
      await showReadyNotice(
        { ...delay, readyAt: new Date(NOW + 22 * 60 * 1000).toISOString() },
        NOW,
      );
      expect(posted()).toBe(2);
    });

    it('foodReadyAt newly set, with the same readyAt, posts again', async () => {
      await showReadyNotice(delay, NOW);
      await showReadyNotice(
        {
          ...delay,
          foodReadyAt: '2026-11-03T12:05:00.000Z',
          delayMinutes: null,
        },
        NOW,
      );
      expect(posted()).toBe(2);
      expect(notifee.displayNotification).toHaveBeenLastCalledWith(
        expect.objectContaining({ body: 'R73 Kitchen: food ready' }),
      );
    });

    it('another job is independent: the same times for a second job still post', async () => {
      await showReadyNotice(delay, NOW);
      await showReadyNotice({ ...delay, deliveryId: 'del-2' }, NOW);
      // And a repeat for the first job, after the second, is still a repeat.
      await showReadyNotice(delay, NOW);
      const ids = (notifee.displayNotification as jest.Mock).mock.calls.map(
        ([n]) => n.id,
      );
      expect(ids).toEqual(['ready-del-1', 'ready-del-2']);
    });

    it('when displayNotification rejects the mark is given back so a later copy of the same change posts, and the rejection still reaches the caller', async () => {
      (notifee.displayNotification as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('notifee: no permission')),
      );
      // The first copy fails, and the rejection still reaches the caller.
      await expect(showReadyNotice(delay, NOW)).rejects.toThrow(
        'notifee: no permission',
      );
      // The mark was given back on rejection, so a later copy of the same change posts.
      await showReadyNotice(delay, NOW);
      const ids = (notifee.displayNotification as jest.Mock).mock.calls.map(
        ([n]) => n.id,
      );
      expect(ids).toEqual(['ready-del-1', 'ready-del-1']);
      // Once that copy posted, a third is a repeat.
      await showReadyNotice(delay, NOW);
      expect(posted()).toBe(2);
    });

    it('a failed post does not wipe a mark for a newer change on the same delivery that arrived meanwhile', async () => {
      let rejectFirstPost!: (err: Error) => void;
      const firstPostDeferred = new Promise((_, reject) => {
        rejectFirstPost = reject;
      });

      // The first post hangs on displayNotification until we reject it.
      (notifee.displayNotification as jest.Mock).mockImplementationOnce(
        () => firstPostDeferred,
      );

      // 1. The first change starts posting and records its mark.
      const firstPostPromise = showReadyNotice(delay, NOW);

      // 2. Meanwhile, a newer change for the same delivery arrives and posts successfully.
      const newerChange: JobReadyUpdate = {
        ...delay,
        foodReadyAt: '2026-11-03T12:05:00.000Z',
        delayMinutes: null,
      };
      await showReadyNotice(newerChange, NOW);
      expect(posted()).toBe(2);
      expect(notifee.displayNotification).toHaveBeenLastCalledWith(
        expect.objectContaining({ body: 'R73 Kitchen: food ready' }),
      );

      // 3. The first post now fails, and its rejection reaches the caller.
      rejectFirstPost(new Error('notifee: display failed'));
      await expect(firstPostPromise).rejects.toThrow('notifee: display failed');

      // 4. A duplicate copy of newerChange (e.g. push following live event) arrives.
      // Its mark was not wiped by the first post's failure, so it does not post again.
      await showReadyNotice(newerChange, NOW);
      expect(posted()).toBe(2);
    });

    it('resetReadyNoticeForTests forgets what was shown', async () => {
      await showReadyNotice(delay, NOW);
      resetReadyNoticeForTests();
      await showReadyNotice(delay, NOW);
      expect(posted()).toBe(2);
    });
  });
});
