import { Platform } from 'react-native';
import notifee from '@notifee/react-native';
import { QueryClient } from '@tanstack/react-query';
import { QueryKeys } from '@app/utilities/queryKeys';
import { RemovalDecision } from '@app/utilities/removalRequest';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import {
  clearRemovalNotices,
  dismissRemovalNotice,
  forgetRemovalDecision,
  receiveRemovalDecision,
  showRemovalDecision,
  useRemovalNotices,
  REMOVAL_CHANNEL_ID,
} from './removalNotice';
import { renderHook, act } from '@testing-library/react-native';
import i18n from '@app/localization/i18n';

describe('removalNotice service (spec 0035, AC-11, decision 24.22, decision 24.23)', () => {
  let queryClient: QueryClient;
  let invalidateSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      clearRemovalNotices();
    });
    queryClient = new QueryClient();
    invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    act(() => {
      clearRemovalNotices();
    });
    queryClient.clear();
  });

  describe('Behaviour 7: receiveRemovalDecision refetches BEFORE showing notice (AC-11)', () => {
    it('refetches before posting notice, and refetches even if displaying the notice fails', async () => {
      const orderOfCalls: string[] = [];

      invalidateSpy.mockImplementation(({ queryKey }) => {
        orderOfCalls.push(`invalidate:${queryKey[0]}`);
      });

      (notifee.displayNotification as jest.Mock).mockImplementationOnce(() => {
        orderOfCalls.push('displayNotification');
        return Promise.reject(new Error('Notifee failed to post'));
      });

      const message = {
        deliveryId: 'del-notice-1',
        outcome: 'APPROVED',
        paid: true,
        payAmount: 350,
        currencyCode: 'EUR',
      };

      await expect(
        receiveRemovalDecision(message, queryClient),
      ).rejects.toThrow('Notifee failed to post');

      // Check all 5 queries were invalidated (spec 0042 AC-13)
      const expectedKeys = [
        QueryKeys.inProgressOrders,
        QueryKeys.newOrders,
        QueryKeys.cancelledJobs,
        QueryKeys.earningsMonth,
        QueryKeys.earningsDelivery,
      ];

      expectedKeys.forEach(key => {
        expect(orderOfCalls).toContain(`invalidate:${key}`);
      });

      // Crucial: invalidations occurred BEFORE displayNotification
      const displayIndex = orderOfCalls.indexOf('displayNotification');
      expect(displayIndex).toBeGreaterThan(0);
      expectedKeys.forEach(key => {
        const invIndex = orderOfCalls.indexOf(`invalidate:${key}`);
        expect(invIndex).toBeLessThan(displayIndex);
      });
    });

    it('ignores invalid decision messages without throwing or invalidating', async () => {
      await receiveRemovalDecision(null, queryClient);
      await receiveRemovalDecision({ deliveryId: '' }, queryClient);
      await receiveRemovalDecision(
        { deliveryId: 'del-x', outcome: 'OTHER' },
        queryClient,
      );

      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });
  });

  describe('Behaviour 8: deduplication and forgetRemovalDecision (decision 24.23)', () => {
    it('shows notice once when same decision arrives twice, and shows again after forgetRemovalDecision', async () => {
      const decision: RemovalDecision = {
        deliveryId: 'del-dedup-1',
        outcome: 'DECLINED',
        decisionNote: 'Wait 10 mins',
        paid: false,
        payAmount: null,
        currencyCode: 'EUR',
      };

      const { result } = renderHook(() => useRemovalNotices());

      // First arrival (e.g. socket)
      await act(async () => {
        await showRemovalDecision(decision);
      });

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      expect(result.current).toHaveLength(1);
      expect(result.current[0].deliveryId).toBe('del-dedup-1');

      // Second arrival (e.g. push with identical content)
      await act(async () => {
        await showRemovalDecision(decision);
      });

      // Still only called once, notice list still length 1
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      expect(result.current).toHaveLength(1);

      // Rider asks again -> forgetRemovalDecision is called
      forgetRemovalDecision('del-dedup-1');

      // Dispatch declines again with the same sentence
      await act(async () => {
        await showRemovalDecision(decision);
      });

      // Second notice displays
      expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
      expect(result.current).toHaveLength(1);
    });

    it('after clearRemovalNotices the same decision shows again (clears dedupe memory)', async () => {
      const decision: RemovalDecision = {
        deliveryId: 'del-clear-mem-1',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: 350,
        currencyCode: 'EUR',
      };

      const { result } = renderHook(() => useRemovalNotices());

      await act(async () => {
        await showRemovalDecision(decision);
      });
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      expect(result.current).toHaveLength(1);

      // Clearing notices empties notices AND dedupe memory (lastShown)
      act(() => {
        clearRemovalNotices();
      });
      expect(result.current).toHaveLength(0);

      // The exact same decision arrives again
      await act(async () => {
        await showRemovalDecision(decision);
      });

      // Shows again because lastShown was cleared
      expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
      expect(result.current).toHaveLength(1);
    });

    it('shows exactly one displayNotification when two identical decisions arrive together without awaiting between them', async () => {
      const originalPlatform = Platform.OS;
      (Platform as any).OS = 'android';

      try {
        const decision: RemovalDecision = {
          deliveryId: 'del-race-sync-1',
          outcome: 'APPROVED',
          decisionNote: null,
          paid: true,
          payAmount: 350,
          currencyCode: 'EUR',
        };

        (notifee.displayNotification as jest.Mock).mockClear();

        // Two calls NOT awaited one after the other (live message and push arriving together)
        const firstCall = showRemovalDecision(decision);
        const secondCall = showRemovalDecision(decision);

        await act(async () => {
          await Promise.all([firstCall, secondCall]);
        });

        expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      } finally {
        (Platform as any).OS = originalPlatform;
      }
    });
  });

  describe('clearRemovalNotices (decision 24.53, minor 5)', () => {
    it('cancels every displayed notification whose id starts with removal- and leaves others alone', async () => {
      (notifee.getDisplayedNotifications as jest.Mock).mockResolvedValueOnce([
        { id: 'removal-del-1', notification: {} },
        { id: 'offer-trip-45', notification: {} },
        { id: 'removal-del-orphan-before-restart', notification: {} },
        { id: 'shift-reminder-1', notification: {} },
      ]);

      (notifee.cancelNotification as jest.Mock).mockClear();

      clearRemovalNotices();

      // clearRemovalNotices is not async, so flush microtasks/promises before asserting
      await act(async () => {
        await Promise.resolve();
      });

      expect(notifee.cancelNotification).toHaveBeenCalledTimes(2);
      expect(notifee.cancelNotification).toHaveBeenNthCalledWith(
        1,
        'removal-del-1',
      );
      expect(notifee.cancelNotification).toHaveBeenNthCalledWith(
        2,
        'removal-del-orphan-before-restart',
      );
      expect(notifee.cancelNotification).not.toHaveBeenCalledWith(
        'offer-trip-45',
      );
      expect(notifee.cancelNotification).not.toHaveBeenCalledWith(
        'shift-reminder-1',
      );
    });

    it('does not throw when getDisplayedNotifications or cancelNotification rejects', async () => {
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Case 1: getDisplayedNotifications rejects
      (notifee.getDisplayedNotifications as jest.Mock).mockRejectedValueOnce(
        new Error('Device IPC failure'),
      );

      expect(() => clearRemovalNotices()).not.toThrow();

      await act(async () => {
        await Promise.resolve();
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Could not clear the removal notifications',
        'Device IPC failure',
      );

      // Case 2: cancelNotification rejects
      (notifee.getDisplayedNotifications as jest.Mock).mockResolvedValueOnce([
        { id: 'removal-del-reject', notification: {} },
      ]);
      (notifee.cancelNotification as jest.Mock).mockRejectedValueOnce(
        new Error('Cancel failed'),
      );

      expect(() => clearRemovalNotices()).not.toThrow();

      await act(async () => {
        await Promise.resolve();
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Could not clear the removal notifications',
        'Cancel failed',
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('Behaviour 9: notice stays until dismissed and names amount only when paid (AC-11, decision 24.22)', () => {
    it('with fake timers, the notice is still in the list after a long advance (hours) and goes only on dismiss', async () => {
      jest.useFakeTimers();
      try {
        const decision: RemovalDecision = {
          deliveryId: 'del-hours-1',
          outcome: 'APPROVED',
          decisionNote: null,
          paid: true,
          payAmount: 350,
          currencyCode: 'EUR',
        };

        const { result } = renderHook(() => useRemovalNotices());

        await act(async () => {
          await showRemovalDecision(decision);
        });

        expect(result.current).toHaveLength(1);
        expect(result.current[0].deliveryId).toBe('del-hours-1');

        // Advance several hours (e.g. 5 hours)
        act(() => {
          jest.advanceTimersByTime(5 * 60 * 60 * 1000);
        });

        // Notice is still in list
        expect(result.current).toHaveLength(1);
        expect(result.current[0].deliveryId).toBe('del-hours-1');

        // Goes only on dismiss
        act(() => {
          dismissRemovalNotice('del-hours-1');
        });

        expect(result.current).toHaveLength(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it('notice stays in store until dismissRemovalNotice is called, which cancels the notification', async () => {
      const decision: RemovalDecision = {
        deliveryId: 'del-dismiss-1',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: 350,
        currencyCode: 'EUR',
      };

      const { result } = renderHook(() => useRemovalNotices());

      await act(async () => {
        await showRemovalDecision(decision);
      });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].deliveryId).toBe('del-dismiss-1');

      // Dismiss the notice
      act(() => {
        dismissRemovalNotice('del-dismiss-1');
      });

      expect(result.current).toHaveLength(0);
      expect(notifee.cancelNotification).toHaveBeenCalledWith(
        'removal-del-dismiss-1',
      );
    });

    it('names the amount when approved and paid', async () => {
      const paidDecision: RemovalDecision = {
        deliveryId: 'del-paid-1',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: 420,
        currencyCode: 'EUR',
      };

      await showRemovalDecision(paidDecision);

      const notificationCall = (notifee.displayNotification as jest.Mock).mock
        .calls[0][0];
      expect(notificationCall.title).toBe(
        i18n.t('translations:removal_notice_title_approved'),
      );
      expect(notificationCall.body).toContain('€4.20');
    });

    it('names no amount when approved and not paid', async () => {
      const unpaidDecision: RemovalDecision = {
        deliveryId: 'del-unpaid-1',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: false,
        payAmount: null,
        currencyCode: 'EUR',
      };

      await showRemovalDecision(unpaidDecision);

      const notificationCall = (notifee.displayNotification as jest.Mock).mock
        .calls[0][0];
      expect(notificationCall.title).toBe(
        i18n.t('translations:removal_notice_title_approved'),
      );
      expect(notificationCall.body).toBe(
        i18n.t('translations:removal_notice_approved_not_paid'),
      );
      expect(notificationCall.body).not.toContain('€');
    });

    it('paid approval with a non-EUR currencyCode shows that currency formatted as the app formats it', async () => {
      const usdDecision: RemovalDecision = {
        deliveryId: 'del-usd-1',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: 450,
        currencyCode: 'USD',
      };

      await showRemovalDecision(usdDecision);

      const notificationCall = (notifee.displayNotification as jest.Mock).mock
        .calls[0][0];
      const expectedFormatted = formatCurrencyFromCents(450, 'USD');
      expect(notificationCall.body).toContain(expectedFormatted);
    });

    it('paid true with payAmount null shows removal_notice_approved and no amount', async () => {
      const paidNullAmount: RemovalDecision = {
        deliveryId: 'del-null-amt',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: true,
        payAmount: null,
        currencyCode: 'EUR',
      };

      await showRemovalDecision(paidNullAmount);

      const notificationCall = (notifee.displayNotification as jest.Mock).mock
        .calls[0][0];
      expect(notificationCall.title).toBe(
        i18n.t('translations:removal_notice_title_approved'),
      );
      expect(notificationCall.body).toBe(
        i18n.t('translations:removal_notice_approved'),
      );
      expect(notificationCall.body).not.toContain('€');
      expect(notificationCall.body).not.toMatch(/\d/);
    });

    it('paid false with payAmount 350 names no amount', async () => {
      const unpaidWithAmount: RemovalDecision = {
        deliveryId: 'del-unpaid-350',
        outcome: 'APPROVED',
        decisionNote: null,
        paid: false,
        payAmount: 350,
        currencyCode: 'EUR',
      };

      await showRemovalDecision(unpaidWithAmount);

      const notificationCall = (notifee.displayNotification as jest.Mock).mock
        .calls[0][0];
      expect(notificationCall.title).toBe(
        i18n.t('translations:removal_notice_title_approved'),
      );
      expect(notificationCall.body).toBe(
        i18n.t('translations:removal_notice_approved_not_paid'),
      );
      expect(notificationCall.body).not.toContain('3.50');
      expect(notificationCall.body).not.toContain('350');
      expect(notificationCall.body).not.toContain('€');
    });
  });

  describe('Android notification channel setup and escape (AC-11)', () => {
    it('on Android createChannel is called with REMOVAL_CHANNEL_ID and displayNotification with android.channelId equal to it', async () => {
      const originalPlatform = Platform.OS;
      (Platform as any).OS = 'android';

      try {
        const decision: RemovalDecision = {
          deliveryId: 'del-android-channel-1',
          outcome: 'APPROVED',
          decisionNote: null,
          paid: true,
          payAmount: 350,
          currencyCode: 'EUR',
        };

        await showRemovalDecision(decision);

        expect(notifee.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            id: REMOVAL_CHANNEL_ID,
          }),
        );

        const notificationCall = (notifee.displayNotification as jest.Mock).mock
          .calls[0][0];
        expect(notificationCall.android).toEqual(
          expect.objectContaining({
            channelId: REMOVAL_CHANNEL_ID,
          }),
        );
      } finally {
        (Platform as any).OS = originalPlatform;
      }
    });
  });

  describe('Behaviour 10: less-than sign in sentence is escaped for notification on Android', () => {
    it('escapes < as &lt; in notifee body on Android', async () => {
      const originalPlatform = Platform.OS;
      (Platform as any).OS = 'android';

      try {
        const decisionWithLessThan: RemovalDecision = {
          deliveryId: 'del-less-than',
          outcome: 'DECLINED',
          decisionNote: 'Wait < 5 mins for food',
          paid: false,
          payAmount: null,
          currencyCode: 'EUR',
        };

        await showRemovalDecision(decisionWithLessThan);

        const notificationCall = (notifee.displayNotification as jest.Mock).mock
          .calls[0][0];
        // Must contain &lt; and NOT raw <
        expect(notificationCall.body).toContain('&lt;');
        expect(notificationCall.body).not.toContain('< 5 mins');
      } finally {
        (Platform as any).OS = originalPlatform;
      }
    });
  });
});
