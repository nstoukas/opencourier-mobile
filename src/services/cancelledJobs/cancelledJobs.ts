// Spec 0015. A job this rider held was cancelled after they accepted it: the app raises an alert of
// its own once per job, shows a full screen card with the pay and what to do with the food, and,
// after a pickup, records what happened to the food. Nothing here decides pay: the server pays.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import i18next from 'i18next';
import { client } from '@app/services/Client';
import { formatCurrencyFromCents } from '@app/utilities/currency';

export type CancelledBy = 'RESTAURANT' | 'CUSTOMER' | 'COOP';
export type FoodOutcome = 'RETURNED' | 'NOT_RETURNED';

// What `GET deliveries/cancelled-jobs` answers for each job: nothing about the customer.
export type CancelledJob = {
  id: string;
  orderReference: string | null;
  pickupName: string;
  pickupBusinessName: string;
  pickupAddress: string;
  pickupPhoneNumber: string;
  cancelledBy: CancelledBy;
  cancelledAt: string;
  pickedUp: boolean;
  // Cents; null until the server has written the pay.
  payAmount: number | null;
  currencyCode: string;
  foodOutcome: FoodOutcome | null;
};

export const fetchCancelledJobs = async (): Promise<CancelledJob[]> => {
  const { data } = await client.get('deliveries/cancelled-jobs');
  // Every response is wrapped by the backend as { error, result }.
  return data.result.data;
};

export const sendFoodOutcome = async (
  deliveryId: string,
  outcome: FoodOutcome,
  note?: string,
): Promise<void> => {
  await client.post(`deliveries/${deliveryId}/food-outcome`, {
    outcome,
    ...(note ? { note } : {}),
  });
};

// The job the card shows now: the newest one still waiting for the rider. After a pickup that is
// until the food outcome is recorded; before a pickup, until the rider taps OK.
export const jobNeedingAttention = (
  jobs: CancelledJob[] | undefined,
  acknowledged: Set<string>,
): CancelledJob | undefined =>
  jobs?.find(job =>
    job.pickedUp ? job.foodOutcome === null : !acknowledged.has(job.id),
  );

export const cancelledByText = (by: CancelledBy): string =>
  i18next.t(`translations:cancelled_by_${by.toLowerCase()}`);

export const cancelledPayText = (job: CancelledJob): string =>
  job.payAmount === null
    ? i18next.t('translations:cancelled_pay_recording')
    : i18next.t('translations:cancelled_pay', {
        amount: formatCurrencyFromCents(job.payAmount, job.currencyCode),
      });

// --- The alert, once per job ---------------------------------------------

export const CANCELLED_JOBS_CHANNEL_ID = 'cancelled-jobs';
// Long buzzes, unlike an offer's ring, so a rider in gloves knows which it is without looking.
export const CANCELLED_VIBRATION = [0, 1000, 400, 1000, 400, 1000];
const ALERTED_KEY = 'cancelledJobsAlerted';
const ACKNOWLEDGED_KEY = 'cancelledJobsAcknowledged';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Creating a channel that exists already changes nothing, so this runs before every alert.
const ensureCancelledChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }
  await notifee.createChannel({
    id: CANCELLED_JOBS_CHANNEL_ID,
    name: i18next.t('translations:cancelled_channel'),
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    vibration: true,
    vibrationPattern: CANCELLED_VIBRATION,
  });
};

// Ids kept on the phone with the time they were added, pruned after 24 hours (the server only
// sends jobs cancelled in the last 24 hours, so an older id can never come back).
type IdTimes = Record<string, number>;

const readIds = async (key: string, now: number): Promise<IdTimes> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const ids: IdTimes = {};
    if (parsed && typeof parsed === 'object') {
      for (const [id, at] of Object.entries(
        parsed as Record<string, unknown>,
      )) {
        if (typeof at === 'number' && now - at < ONE_DAY_MS) {
          ids[id] = at;
        }
      }
    }
    return ids;
  } catch {
    // Unreadable: start again. At worst a job alerts a second time, never not at all.
    return {};
  }
};

const addId = async (key: string, id: string, now: number) => {
  const ids = await readIds(key, now);
  ids[id] = now;
  await AsyncStorage.setItem(key, JSON.stringify(ids));
};

export const loadAcknowledged = async (
  now = Date.now(),
): Promise<Set<string>> =>
  new Set(Object.keys(await readIds(ACKNOWLEDGED_KEY, now)));

export const acknowledgeJob = (id: string, now = Date.now()) =>
  addId(ACKNOWLEDGED_KEY, id, now);

// Raises the alert for each job not alerted before, and remembers it (AC-7). Returns the ids it
// alerted. The open app and a push both call this, so a job alerts once whichever comes first.
export const alertNewCancelledJobs = async (
  jobs: Pick<CancelledJob, 'id' | 'pickupBusinessName' | 'cancelledBy'>[],
  now = Date.now(),
): Promise<string[]> => {
  const alerted = await readIds(ALERTED_KEY, now);
  const fresh = jobs.filter(job => alerted[job.id] === undefined);
  if (fresh.length === 0) {
    return [];
  }
  await ensureCancelledChannel();
  for (const job of fresh) {
    await notifee.displayNotification({
      id: `cancelled-${job.id}`,
      title: i18next.t('translations:cancelled_title'),
      body: job.pickupBusinessName
        ? i18next.t('translations:cancelled_body', {
            restaurant: job.pickupBusinessName,
            by: cancelledByText(job.cancelledBy),
          })
        : i18next.t('translations:cancelled_body_unknown'),
      android: {
        channelId: CANCELLED_JOBS_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        vibrationPattern: CANCELLED_VIBRATION,
        pressAction: { id: 'default' },
      },
    });
    alerted[job.id] = now;
  }
  await AsyncStorage.setItem(ALERTED_KEY, JSON.stringify(alerted));
  return fresh.map(job => job.id);
};
