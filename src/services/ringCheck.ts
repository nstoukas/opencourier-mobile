// "Is my phone set up to ring?" (row 84, wishlist item 35). Reads the phone's
// own settings that decide whether an offer can ring, names each one that is
// wrong, and opens the phone's setting that fixes it.
//
// Everything here is read at the moment the rider looks and then forgotten:
// nothing is stored on the phone or sent to the co-op (value 5). The app never
// changes a setting itself; it only opens the phone's own screen, and the
// rider decides there.
//
// It reuses what the app already has: notifee (notifications, the offer
// channels, battery optimisation) and the app's own Android module behind
// `offerPush/phone.ts` (ringer, Do Not Disturb, full screen alerts). No new
// package and no native change.

import { Linking, Platform } from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import {
  canUseFullScreenAlert,
  getRingerState,
  openFullScreenAlertSettings,
  openSoundSettings,
} from '@app/services/offerPush/phone';
import {
  ensureOfferChannels,
  OFFERS_CHANNEL_ID,
  OFFERS_INSISTENT_CHANNEL_ID,
} from '@app/services/offerPush/offerAlert';

// One thing the check looks at, in the order the screen lists them.
export type RingCheckId =
  | 'notifications'
  | 'offer_alerts'
  | 'full_screen'
  | 'sound'
  | 'battery';

// What is wrong, when something is. Each one is also the last part of its
// sentence's translation key (`ring_problem_<problem>`).
export type RingProblem =
  | 'notifications_off'
  | 'offer_alerts_off'
  | 'full_screen_off'
  | 'phone_silent'
  | 'phone_vibrate'
  | 'do_not_disturb'
  | 'battery_optimised';

// `problem` is null when that setting is fine, or when the phone would not
// say (a read that fails is never reported as a problem the rider must fix).
export type RingCheckItem = {
  id: RingCheckId;
  problem: RingProblem | null;
};

// Each read on its own: one that throws counts as "fine", so a phone that
// lacks one screen or answer still gets the rest of the check.
const safely = async (
  read: () => Promise<RingProblem | null>,
): Promise<RingProblem | null> => {
  try {
    return await read();
  } catch (error) {
    console.log('Ring check could not read a setting', String(error));
    return null;
  }
};

const readNotifications = async (): Promise<RingProblem | null> => {
  // On Android this answers DENIED both for "not allowed" (Android 13 and
  // later) and for the app's notifications switched off (any version).
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus === AuthorizationStatus.DENIED
    ? 'notifications_off'
    : null;
};

// The two channels an offer rings on. Android lets the rider switch off one
// kind of alert while the app's notifications stay on.
const blockedOfferChannel = async (): Promise<string | null> => {
  // Make the channels first: a channel that does not exist yet reads as "not
  // blocked", which would hide nothing, but this keeps the answer honest on a
  // phone that has never had an offer. Making one that exists changes nothing.
  await ensureOfferChannels();
  for (const channelId of [OFFERS_CHANNEL_ID, OFFERS_INSISTENT_CHANNEL_ID]) {
    if (await notifee.isChannelBlocked(channelId)) {
      return channelId;
    }
  }
  return null;
};

const readOfferAlerts = async (): Promise<RingProblem | null> =>
  (await blockedOfferChannel()) !== null ? 'offer_alerts_off' : null;

const readFullScreen = async (): Promise<RingProblem | null> =>
  (await canUseFullScreenAlert()) ? null : 'full_screen_off';

const readSound = async (): Promise<RingProblem | null> => {
  const ringer = await getRingerState();
  // Silent or vibrate first: the ringer is the plainer thing to fix.
  if (ringer.ringerMode === 'silent') {
    return 'phone_silent';
  }
  if (ringer.ringerMode === 'vibrate') {
    return 'phone_vibrate';
  }
  return ringer.doNotDisturb ? 'do_not_disturb' : null;
};

const readBattery = async (): Promise<RingProblem | null> =>
  (await notifee.isBatteryOptimizationEnabled()) ? 'battery_optimised' : null;

// Runs every check this phone supports and lists each with its answer.
// On iPhone only notifications can be read today: silent mode has no public
// answer there and battery optimisation is Android's. Row 59 (offer alerts on
// iPhone) can add more once it is built on a Mac.
export const checkPhoneRings = async (): Promise<RingCheckItem[]> => {
  if (Platform.OS !== 'android') {
    return [{ id: 'notifications', problem: await safely(readNotifications) }];
  }
  // `Promise.all` runs the reads side by side and waits for every one.
  const [notifications, offerAlerts, fullScreen, sound, battery] =
    await Promise.all([
      safely(readNotifications),
      safely(readOfferAlerts),
      safely(readFullScreen),
      safely(readSound),
      safely(readBattery),
    ]);
  return [
    { id: 'notifications', problem: notifications },
    { id: 'offer_alerts', problem: offerAlerts },
    { id: 'full_screen', problem: fullScreen },
    { id: 'sound', problem: sound },
    { id: 'battery', problem: battery },
  ];
};

// Opens the phone's own setting that fixes `problem`. Never changes anything
// itself. A screen that will not open falls back to the app's page in the
// phone's settings, where every one of these can be reached.
export const openFixFor = async (problem: RingProblem): Promise<void> => {
  try {
    if (Platform.OS !== 'android') {
      await Linking.openSettings();
      return;
    }
    switch (problem) {
      case 'notifications_off':
        await notifee.openNotificationSettings();
        return;
      case 'offer_alerts_off':
        // Straight to the switched off kind of alert, when it can be told.
        await notifee.openNotificationSettings(
          (await blockedOfferChannel()) ?? undefined,
        );
        return;
      case 'full_screen_off':
        openFullScreenAlertSettings();
        return;
      case 'phone_silent':
      case 'phone_vibrate':
      case 'do_not_disturb':
        // Android's sound settings hold the ringer and Do Not Disturb.
        openSoundSettings();
        return;
      case 'battery_optimised':
        await notifee.openBatteryOptimizationSettings();
        return;
    }
  } catch (error) {
    console.log('Could not open the setting', String(error));
    Linking.openSettings().catch(() => undefined);
  }
};

// True when at least one check found something to fix.
export const hasRingProblem = (items: RingCheckItem[]): boolean =>
  items.some(item => item.problem !== null);
