import { Platform } from 'react-native';
import notifee from '@notifee/react-native';
import { QueryClient } from '@tanstack/react-query';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  SPLIT_CHANNEL_ID,
  SplitDecision,
  clearSplitNotices,
  forgetSplitDecision,
  parseSplitDecision,
  receiveSplitDecision,
  showSplitDecision,
  splitNoticeText,
  splitNoticeTitle,
} from './splitNotice';

// Spec 0047 (cross check 12), row 11 review: dispatch's answer to a split request reaches the rider the
// way a removal answer does: the jobs are read again and a notification with the phone's sound says it,
// once per answer, whether it came over the live connection, by push, or both.
describe('splitNotice (spec 0047, cross check 12, row 11 review)', () => {
  let queryClient: QueryClient;
  let invalidateSpy: jest.SpyInstance;
  const t = i18n.t.bind(i18n) as (key: string, options?: any) => string;

  // What the live connection sends: an object with nulls.
  const liveRefused = {
    deliveryId: 'del-1',
    outcome: 'REFUSED',
    adminNote: 'It fits if you turn it',
    legNumber: null,
    legCount: null,
    boxSize: null,
  };
  // What a push sends: every value a string, '' for none (offer-push.service.ts).
  const pushConfirmed = {
    type: 'SPLIT_REQUEST_DECIDED',
    deliveryId: 'del-1',
    outcome: 'CONFIRMED',
    adminNote: '',
    legNumber: '1',
    legCount: '2',
    boxSize: 'MEDIUM',
  };

  const confirmed = (overrides: Partial<SplitDecision> = {}): SplitDecision => ({
    deliveryId: 'del-1',
    outcome: 'CONFIRMED',
    adminNote: null,
    boxSize: 'MEDIUM',
    ...overrides,
  });
  const refused = (overrides: Partial<SplitDecision> = {}): SplitDecision => ({
    deliveryId: 'del-1',
    outcome: 'REFUSED',
    adminNote: null,
    boxSize: null,
    ...overrides,
  });

  // The notification last posted, as notifee was given it.
  const lastPosted = () => {
    const calls = (notifee.displayNotification as jest.Mock).mock.calls;
    return calls[calls.length - 1][0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearSplitNotices();
    (notifee.getDisplayedNotifications as jest.Mock).mockClear();
    queryClient = new QueryClient();
    invalidateSpy = jest
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    clearSplitNotices();
    queryClient.clear();
  });

  describe('parseSplitDecision', () => {
    it("reads the live connection's object", () => {
      expect(parseSplitDecision(liveRefused)).toEqual({
        deliveryId: 'del-1',
        outcome: 'REFUSED',
        adminNote: 'It fits if you turn it',
        boxSize: null,
      });
      expect(
        parseSplitDecision({
          ...liveRefused,
          outcome: 'CONFIRMED',
          adminNote: null,
          legNumber: 1,
          legCount: 2,
          boxSize: 'LARGE',
        }),
      ).toEqual({
        deliveryId: 'del-1',
        outcome: 'CONFIRMED',
        adminNote: null,
        boxSize: 'LARGE',
      });
    });

    it("reads a push's strings the same way: '' means none", () => {
      expect(parseSplitDecision(pushConfirmed)).toEqual({
        deliveryId: 'del-1',
        outcome: 'CONFIRMED',
        adminNote: null,
        boxSize: 'MEDIUM',
      });
      expect(
        parseSplitDecision({
          ...pushConfirmed,
          outcome: 'REFUSED',
          adminNote: 'It fits',
          boxSize: '',
        }),
      ).toEqual({
        deliveryId: 'del-1',
        outcome: 'REFUSED',
        adminNote: 'It fits',
        boxSize: null,
      });
    });

    it("trims dispatch's sentence, and a sentence of only spaces is none", () => {
      expect(
        parseSplitDecision({ ...liveRefused, adminNote: '  It fits  ' })
          ?.adminNote,
      ).toBe('It fits');
      expect(
        parseSplitDecision({ ...liveRefused, adminNote: '   ' })?.adminNote,
      ).toBeNull();
    });

    it.each(['SMALL', 'MEDIUM', 'LARGE'])('keeps the size %s', boxSize => {
      expect(
        parseSplitDecision({ ...pushConfirmed, boxSize })?.boxSize,
      ).toBe(boxSize);
    });

    it('a size the app does not know is no size, not a made up one', () => {
      expect(
        parseSplitDecision({ ...pushConfirmed, boxSize: 'HUGE' })?.boxSize,
      ).toBeNull();
    });

    it.each([
      ['nothing', null],
      ['a string', 'SPLIT_REQUEST_DECIDED'],
      ['no delivery', { outcome: 'REFUSED' }],
      ['an empty delivery id', { deliveryId: '', outcome: 'REFUSED' }],
      ['a delivery id that is not text', { deliveryId: 7, outcome: 'REFUSED' }],
      ['no outcome', { deliveryId: 'del-1' }],
      ['an outcome that is no answer', { deliveryId: 'del-1', outcome: 'LEFT' }],
      ['an outcome in small letters', { deliveryId: 'del-1', outcome: 'refused' }],
    ])('answers null for %s', (_name, message) => {
      expect(parseSplitDecision(message)).toBeNull();
    });
  });

  describe('the words of the notice', () => {
    it('a refusal: "Dispatch says it fits", with dispatch\'s sentence or the plain one', () => {
      expect(splitNoticeTitle(refused(), t)).toBe('Dispatch says it fits');
      expect(splitNoticeText(refused({ adminNote: 'Turn it' }), t)).toBe(
        'Dispatch: Turn it',
      );
      expect(splitNoticeText(refused(), t)).toBe('Dispatch: it fits one box');
    });

    it('a confirm: "Dispatch split the order", naming the size the rider keeps', () => {
      expect(splitNoticeTitle(confirmed(), t)).toBe('Dispatch split the order');
      expect(splitNoticeText(confirmed({ boxSize: 'MEDIUM' }), t)).toBe(
        'Split by dispatch: you take the Medium box',
      );
      expect(splitNoticeText(confirmed({ boxSize: null }), t)).toBe(
        'Split by dispatch: you take your box',
      );
    });
  });

  describe('showSplitDecision: the notice, once per answer', () => {
    it('posts one notification for the delivery, with the title and the sentence', async () => {
      await showSplitDecision(refused({ adminNote: 'Turn it' }));

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      const posted = lastPosted();
      expect(posted.id).toBe('split-del-1');
      expect(posted.title).toBe('Dispatch says it fits');
      expect(posted.body).toBe('Dispatch: Turn it');
    });

    it("on Android it uses its own channel, made with the phone's sound (a channel with none is silent)", async () => {
      const originalPlatform = Platform.OS;
      (Platform as any).OS = 'android';
      try {
        await showSplitDecision(confirmed());

        expect(notifee.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({ id: SPLIT_CHANNEL_ID, sound: 'default' }),
        );
        expect(lastPosted().android.channelId).toBe(SPLIT_CHANNEL_ID);
      } finally {
        (Platform as any).OS = originalPlatform;
      }
    });

    it('on iOS the notification asks for the default sound', async () => {
      await showSplitDecision(confirmed());
      expect(lastPosted().ios).toEqual({ sound: 'default' });
    });

    // Android reads a notification's body as HTML, and this sentence comes from outside the app (row 105).
    it("on Android dispatch's sentence cannot draw markup in the notification", async () => {
      const originalPlatform = Platform.OS;
      (Platform as any).OS = 'android';
      try {
        await showSplitDecision(refused({ adminNote: '<b>It fits</b>' }));
        expect(lastPosted().body).not.toContain('<b>');
        expect(lastPosted().body).toContain('It fits');
      } finally {
        (Platform as any).OS = originalPlatform;
      }
    });

    it('the same answer arriving twice (live message, then push) is shown once', async () => {
      await showSplitDecision(refused({ adminNote: 'Turn it' }));
      await showSplitDecision(refused({ adminNote: 'Turn it' }));

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    });

    it('is shown once when the two arrive together, with no wait between them', async () => {
      const first = showSplitDecision(confirmed());
      const second = showSplitDecision(confirmed());
      await Promise.all([first, second]);

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    });

    it('a different answer for the same delivery is shown', async () => {
      await showSplitDecision(refused());
      await showSplitDecision(confirmed());

      expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
      expect(lastPosted().title).toBe('Dispatch split the order');
    });

    it('the same answer for another delivery is shown', async () => {
      await showSplitDecision(refused());
      await showSplitDecision(refused({ deliveryId: 'del-2' }));

      expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
      expect(lastPosted().id).toBe('split-del-2');
    });

    it('after the rider flags again (forgetSplitDecision) the same words are a new answer', async () => {
      await showSplitDecision(refused());
      forgetSplitDecision('del-1');
      await showSplitDecision(refused());

      expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
    });

    it('forgetting one delivery leaves the others remembered', async () => {
      await showSplitDecision(refused());
      forgetSplitDecision('del-other');
      await showSplitDecision(refused());

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('receiveSplitDecision: read the jobs again, then tell the rider', () => {
    it('reads the jobs and the earnings again BEFORE posting the notice', async () => {
      const order: string[] = [];
      invalidateSpy.mockImplementation(({ queryKey }: any) => {
        order.push(`invalidate:${queryKey[0]}`);
        return Promise.resolve();
      });
      (notifee.displayNotification as jest.Mock).mockImplementationOnce(() => {
        order.push('notice');
        return Promise.resolve();
      });

      await receiveSplitDecision(liveRefused, queryClient);

      const noticeAt = order.indexOf('notice');
      expect(noticeAt).toBeGreaterThan(0);
      for (const key of [
        QueryKeys.inProgressOrders,
        QueryKeys.earningsMonth,
        QueryKeys.earningsDelivery,
      ]) {
        const at = order.indexOf(`invalidate:${key}`);
        expect(at).toBeGreaterThanOrEqual(0);
        expect(at).toBeLessThan(noticeAt);
      }
    });

    it('still reads the jobs again when the notice cannot be posted', async () => {
      (notifee.displayNotification as jest.Mock).mockRejectedValueOnce(
        new Error('Notifee failed to post'),
      );

      await expect(
        receiveSplitDecision(liveRefused, queryClient),
      ).rejects.toThrow('Notifee failed to post');

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
    });

    it("posts the notice for a push's strings as for the live object", async () => {
      await receiveSplitDecision(pushConfirmed, queryClient);

      expect(lastPosted().title).toBe('Dispatch split the order');
      expect(lastPosted().body).toBe(
        'Split by dispatch: you take the Medium box',
      );
    });

    it('the live message and the push for one answer: one notice, the jobs read each time', async () => {
      const live = { ...liveRefused, adminNote: null };
      const push = {
        ...pushConfirmed,
        outcome: 'REFUSED',
        adminNote: '',
        boxSize: '',
      };

      await receiveSplitDecision(live, queryClient);
      await receiveSplitDecision(push, queryClient);

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      expect(
        invalidateSpy.mock.calls.filter(
          ([arg]) => arg.queryKey[0] === QueryKeys.inProgressOrders,
        ),
      ).toHaveLength(2);
    });

    it('a message that is no answer does nothing and does not throw', async () => {
      await receiveSplitDecision(null, queryClient);
      await receiveSplitDecision({ deliveryId: '' }, queryClient);
      await receiveSplitDecision(
        { deliveryId: 'del-1', outcome: 'OTHER' },
        queryClient,
      );

      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });
  });

  describe('clearSplitNotices: the next rider on this phone sees none of it', () => {
    it("takes down the split notifications and leaves every other kind", async () => {
      (notifee.getDisplayedNotifications as jest.Mock).mockResolvedValueOnce([
        { id: 'split-del-1', notification: {} },
        { id: 'removal-del-1', notification: {} },
        { id: 'offer-trip-45', notification: {} },
        { id: 'split-del-from-before-a-restart', notification: {} },
        { notification: {} },
      ]);

      clearSplitNotices();
      // The clearing runs on its own; let it finish.
      await new Promise(resolve => setImmediate(resolve));

      expect(notifee.cancelNotification).toHaveBeenCalledTimes(2);
      expect(notifee.cancelNotification).toHaveBeenCalledWith('split-del-1');
      expect(notifee.cancelNotification).toHaveBeenCalledWith(
        'split-del-from-before-a-restart',
      );
    });

    it('forgets what was shown: the same answer shows again afterwards', async () => {
      await showSplitDecision(refused());
      clearSplitNotices();
      await showSplitDecision(refused());

      expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
    });

    it('does not throw when the phone cannot list its notifications', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      (notifee.getDisplayedNotifications as jest.Mock).mockRejectedValueOnce(
        new Error('no notification service'),
      );

      expect(() => clearSplitNotices()).not.toThrow();
      await new Promise(resolve => setImmediate(resolve));

      expect(notifee.cancelNotification).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });
});
