import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { client } from '@app/services/Client';
import '@app/localization/i18n';
import {
  ensureOfferChannels,
  OFFERS_INSISTENT_CHANNEL_ID,
} from '@app/services/offerPush/offerAlert';
import {
  acknowledgeJob,
  alertNewCancelledJobs,
  CANCELLED_JOBS_CHANNEL_ID,
  CANCELLED_VIBRATION,
  cancelledByText,
  cancelledPayText,
  fetchCancelledJobs,
  jobNeedingAttention,
  loadAcknowledged,
  sendFoodOutcome,
  CancelledJob,
} from './cancelledJobs';

jest.mock('@app/services/Client', () => ({
  client: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('cancelledJobs service (spec 0015, AC-7, AC-8, AC-12, decisions 32.9, 32.16)', () => {
  const originalOS = Platform.OS;

  beforeEach(async () => {
    Platform.OS = 'android';
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  describe('fetchCancelledJobs & sendFoodOutcome', () => {
    it('fetchCancelledJobs calls GET deliveries/cancelled-jobs and returns result.data', async () => {
      const mockJobs: Partial<CancelledJob>[] = [
        { id: 'del-1', pickupBusinessName: 'Test Tavern' },
      ];
      (client.get as jest.Mock).mockResolvedValueOnce({
        data: {
          error: null,
          result: { data: mockJobs },
        },
      });

      const result = await fetchCancelledJobs();
      expect(client.get).toHaveBeenCalledWith('deliveries/cancelled-jobs');
      expect(result).toEqual(mockJobs);
    });

    it('sendFoodOutcome posts outcome without note when note is undefined (RETURNED)', async () => {
      (client.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
      });

      await sendFoodOutcome('del-123', 'RETURNED');
      expect(client.post).toHaveBeenCalledWith(
        'deliveries/del-123/food-outcome',
        {
          outcome: 'RETURNED',
        },
      );
    });

    it('sendFoodOutcome posts outcome with note when note is provided (NOT_RETURNED)', async () => {
      (client.post as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
      });

      await sendFoodOutcome(
        'del-123',
        'NOT_RETURNED',
        'Customer was not at address',
      );
      expect(client.post).toHaveBeenCalledWith(
        'deliveries/del-123/food-outcome',
        {
          outcome: 'NOT_RETURNED',
          note: 'Customer was not at address',
        },
      );
    });
  });

  describe('jobNeedingAttention (AC-7, AC-8, AC-12)', () => {
    const baseJob: CancelledJob = {
      id: 'del-1',
      orderReference: 'REF-1',
      pickupName: 'Taverna',
      pickupBusinessName: 'Taverna Ouzeri',
      pickupAddress: 'Plateia 1, Volos',
      pickupPhoneNumber: '+302421011111',
      cancelledBy: 'RESTAURANT',
      cancelledAt: '2026-11-01T12:00:00Z',
      pickedUp: true,
      payAmount: 350,
      currencyCode: 'EUR',
      foodOutcome: null,
    };

    it('returns undefined when jobs list is undefined or empty', () => {
      expect(jobNeedingAttention(undefined, new Set())).toBeUndefined();
      expect(jobNeedingAttention([], new Set())).toBeUndefined();
    });

    it('picked up and no outcome -> shown', () => {
      const job: CancelledJob = {
        ...baseJob,
        pickedUp: true,
        foodOutcome: null,
      };
      expect(jobNeedingAttention([job], new Set())).toBe(job);
    });

    it('picked up with outcome -> not shown', () => {
      const jobReturned: CancelledJob = {
        ...baseJob,
        pickedUp: true,
        foodOutcome: 'RETURNED',
      };
      const jobNotReturned: CancelledJob = {
        ...baseJob,
        pickedUp: true,
        foodOutcome: 'NOT_RETURNED',
      };
      expect(jobNeedingAttention([jobReturned], new Set())).toBeUndefined();
      expect(jobNeedingAttention([jobNotReturned], new Set())).toBeUndefined();
    });

    it('not picked up and not acknowledged -> shown', () => {
      const job: CancelledJob = {
        ...baseJob,
        id: 'del-not-ack',
        pickedUp: false,
        foodOutcome: null,
      };
      expect(jobNeedingAttention([job], new Set())).toBe(job);
    });

    it('not picked up and acknowledged -> not shown', () => {
      const job: CancelledJob = {
        ...baseJob,
        id: 'del-ack',
        pickedUp: false,
        foodOutcome: null,
      };
      expect(jobNeedingAttention([job], new Set(['del-ack']))).toBeUndefined();
    });

    it('returns the first (newest) job needing attention from the list', () => {
      const alreadyHandled: CancelledJob = {
        ...baseJob,
        id: 'del-done',
        pickedUp: true,
        foodOutcome: 'RETURNED',
      };
      const newestNeedingAttention: CancelledJob = {
        ...baseJob,
        id: 'del-newest',
        pickedUp: true,
        foodOutcome: null,
      };
      const olderNeedingAttention: CancelledJob = {
        ...baseJob,
        id: 'del-older',
        pickedUp: false,
        foodOutcome: null,
      };

      const result = jobNeedingAttention(
        [alreadyHandled, newestNeedingAttention, olderNeedingAttention],
        new Set(),
      );
      expect(result).toBe(newestNeedingAttention);
    });
  });

  describe('cancelledByText lookup (item 10)', () => {
    it('RESTAURANT, CUSTOMER, COOP return their translated strings', () => {
      expect(cancelledByText('RESTAURANT')).toBe('the restaurant');
      expect(cancelledByText('CUSTOMER')).toBe('the customer');
      expect(cancelledByText('COOP')).toBe('the co-op');
    });

    it('an unknown value falls back to co-op words, never a raw "translations:" key', () => {
      const result = cancelledByText('UNKNOWN_PARTY' as any);
      expect(result).toBe('the co-op');
      expect(result).not.toContain('translations:');
    });
  });

  describe('cancelledPayText', () => {
    it('returns recording pay text when payAmount is null', () => {
      const job: CancelledJob = {
        id: 'del-1',
        orderReference: null,
        pickupName: 'Shop',
        pickupBusinessName: 'Shop',
        pickupAddress: 'Address',
        pickupPhoneNumber: '123',
        cancelledBy: 'COOP',
        cancelledAt: '2026-11-01T12:00:00Z',
        pickedUp: false,
        payAmount: null,
        currencyCode: 'EUR',
        foodOutcome: null,
      };
      expect(cancelledPayText(job)).toBe(
        'Your pay for this job is being recorded.',
      );
    });

    it('returns formatted pay text when payAmount is provided in cents', () => {
      const job: CancelledJob = {
        id: 'del-1',
        orderReference: null,
        pickupName: 'Shop',
        pickupBusinessName: 'Shop',
        pickupAddress: 'Address',
        pickupPhoneNumber: '123',
        cancelledBy: 'COOP',
        cancelledAt: '2026-11-01T12:00:00Z',
        pickedUp: false,
        payAmount: 450,
        currencyCode: 'EUR',
        foodOutcome: null,
      };
      expect(cancelledPayText(job)).toBe('You are paid €4.50 for this job.');
    });
  });

  describe('loadAcknowledged and acknowledgeJob (AC-12)', () => {
    it('acknowledges a job and retrieves it in loadAcknowledged', async () => {
      const now = 1700000000000;
      await acknowledgeJob('del-ack-1', now);

      const acknowledged = await loadAcknowledged(now);
      expect(acknowledged.has('del-ack-1')).toBe(true);
    });

    it('prunes acknowledged ids older than 24 hours', async () => {
      const now = 1700000000000;
      const twentyFiveHoursAgo = now - 25 * 60 * 60 * 1000;
      const oneHourAgo = now - 1 * 60 * 60 * 1000;

      // Seed storage directly with one expired and one recent id
      await AsyncStorage.setItem(
        'cancelledJobsAcknowledged',
        JSON.stringify({
          'del-old': twentyFiveHoursAgo,
          'del-recent': oneHourAgo,
        }),
      );

      const acknowledged = await loadAcknowledged(now);
      expect(acknowledged.has('del-recent')).toBe(true);
      expect(acknowledged.has('del-old')).toBe(false);
    });

    it('returns an empty set safely when storage has unreadable JSON', async () => {
      await AsyncStorage.setItem(
        'cancelledJobsAcknowledged',
        '{ corrupted json',
      );

      const acknowledged = await loadAcknowledged();
      expect(acknowledged.size).toBe(0);
    });
  });

  describe('alertNewCancelledJobs (spec 0015, AC-7, item 1)', () => {
    it('creates notification channel and displays one notification per new id on channel cancelled-job-alerts with vibration pattern', async () => {
      const jobs = [
        {
          id: 'del-alert-1',
          pickupBusinessName: 'Bakery Alpha',
          cancelledBy: 'RESTAURANT' as const,
        },
      ];

      const alertedIds = await alertNewCancelledJobs(jobs);

      expect(alertedIds).toEqual(['del-alert-1']);
      expect(notifee.createChannel).toHaveBeenCalledWith({
        id: CANCELLED_JOBS_CHANNEL_ID,
        name: 'Cancelled jobs',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        vibration: true,
        vibrationPattern: CANCELLED_VIBRATION,
      });

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      expect(notifee.displayNotification).toHaveBeenCalledWith({
        id: 'cancelled-del-alert-1',
        title: 'Job cancelled',
        body: 'Bakery Alpha: cancelled by the restaurant.',
        android: {
          channelId: CANCELLED_JOBS_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          vibrationPattern: CANCELLED_VIBRATION,
          pressAction: { id: 'default' },
        },
      });
    });

    it('pins CANCELLED_JOBS_CHANNEL_ID to "cancelled-job-alerts", avoiding the old soundless "cancelled-jobs"', () => {
      // Android fixes a channel's sound on creation. The old id 'cancelled-jobs' shipped without sound,
      // so any phone that created it remains silent unless a new channel id is used (row 32 verify).
      expect(CANCELLED_JOBS_CHANNEL_ID).toBe('cancelled-job-alerts');
      expect(CANCELLED_JOBS_CHANNEL_ID).not.toBe('cancelled-jobs');
    });

    it('pins CANCELLED_VIBRATION to notifee rule: even count of values and every value a positive integer (> 0)', () => {
      // notifee refuses createChannel on Android when vibrationPattern starts with 0 or has an odd count:
      // "expected an array containing an even number of positive values"
      expect(Array.isArray(CANCELLED_VIBRATION)).toBe(true);
      expect(CANCELLED_VIBRATION.length).toBeGreaterThan(0);
      expect(CANCELLED_VIBRATION.length % 2).toBe(0);

      // Must fail on old [0, 1000, 400, ...] pattern even with notifee mocked
      for (const ms of CANCELLED_VIBRATION) {
        expect(Number.isInteger(ms)).toBe(true);
        expect(ms).toBeGreaterThan(0);
      }
    });

    it('pins CANCELLED_VIBRATION to be distinct from the offer alert vibration pattern', async () => {
      // Spec 0015 AC-7: "a long vibration pattern unlike the offer's"
      await ensureOfferChannels();
      const insistentCall = (
        notifee.createChannel as jest.Mock
      ).mock.calls.find(args => args[0]?.id === OFFERS_INSISTENT_CHANNEL_ID);
      const offerPattern = insistentCall?.[0]?.vibrationPattern;
      expect(offerPattern).toBeDefined();
      expect(CANCELLED_VIBRATION).not.toEqual(offerPattern);
    });

    it('ensures alertNewCancelledJobs creates channel and posts notification with matching channel id and attributes', async () => {
      const jobs = [
        {
          id: 'del-pin-channel',
          pickupBusinessName: 'Souvlaki Bar',
          cancelledBy: 'CUSTOMER' as const,
        },
      ];

      await alertNewCancelledJobs(jobs);

      const channelCall = (notifee.createChannel as jest.Mock).mock.calls.find(
        args => args[0]?.id === CANCELLED_JOBS_CHANNEL_ID,
      );
      expect(channelCall).toBeDefined();
      expect(channelCall[0]).toEqual(
        expect.objectContaining({
          id: CANCELLED_JOBS_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
          vibrationPattern: CANCELLED_VIBRATION,
        }),
      );

      const notificationCall = (
        notifee.displayNotification as jest.Mock
      ).mock.calls.find(args => args[0]?.id === 'cancelled-del-pin-channel');
      expect(notificationCall).toBeDefined();
      expect(notificationCall[0].android.channelId).toBe(
        CANCELLED_JOBS_CHANNEL_ID,
      );
    });

    it('a second call with the same ids displays none (deduplication)', async () => {
      const jobs = [
        {
          id: 'del-dup-1',
          pickupBusinessName: 'Cafe Central',
          cancelledBy: 'CUSTOMER' as const,
        },
      ];

      const firstCall = await alertNewCancelledJobs(jobs);
      expect(firstCall).toEqual(['del-dup-1']);
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);

      (notifee.displayNotification as jest.Mock).mockClear();

      const secondCall = await alertNewCancelledJobs(jobs);
      expect(secondCall).toEqual([]);
      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });

    it('prunes alerted ids older than 24 hours so stored ids do not grow', async () => {
      const now = 1700000000000;
      const twentyFiveHoursAgo = now - 25 * 60 * 60 * 1000;

      // Seed storage with an id from 25 hours ago
      await AsyncStorage.setItem(
        'cancelledJobsAlerted',
        JSON.stringify({
          'del-expired': twentyFiveHoursAgo,
        }),
      );

      // Now alert for a new delivery
      await alertNewCancelledJobs(
        [{ id: 'del-fresh', pickupBusinessName: 'Fresh Food' }],
        now,
      );

      // Verify the storage was written without del-expired
      const raw = await AsyncStorage.getItem('cancelledJobsAlerted');
      const parsed = JSON.parse(raw!);
      expect(parsed['del-fresh']).toBe(now);
      expect(parsed['del-expired']).toBeUndefined();
    });

    it('unreadable storage alerts rather than staying silent', async () => {
      await AsyncStorage.setItem('cancelledJobsAlerted', 'NOT_VALID_JSON!!!');

      const alertedIds = await alertNewCancelledJobs([
        { id: 'del-recover', pickupBusinessName: 'Recovery Shop' },
      ]);

      expect(alertedIds).toEqual(['del-recover']);
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
    });

    it('a job with no restaurant name uses the unknown body', async () => {
      await alertNewCancelledJobs([
        { id: 'del-unknown-name', pickupBusinessName: '' },
      ]);

      expect(notifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'A job you took was cancelled. Open the app to see what to do.',
        }),
      );
    });

    it('accepts a job with no cancelledBy (e.g. push notification path) and uses generic co-op wording if restaurant name present', async () => {
      await alertNewCancelledJobs([
        { id: 'del-no-by', pickupBusinessName: 'Mystery Restaurant' },
      ]);

      expect(notifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Mystery Restaurant: cancelled by the co-op.',
        }),
      );
    });
  });
});
