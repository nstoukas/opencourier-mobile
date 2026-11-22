// The app's own small Android module for offer alerts (row 58, spec 0003),
// `android/app/src/main/java/com/opendeli/OfferAlertModule.kt`. It reads the
// ringer and Do Not Disturb, says whether full screen alerts are allowed, and
// opens Android's settings screens. It never changes a setting by itself.
//
// On iPhone (row 59), in tests, or on an app built before the module existed,
// the module is missing: every function below then does nothing and reports
// "all fine", so going Online never gets stuck on a missing module.

import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

export type RingerState = {
  ringerMode: 'normal' | 'vibrate' | 'silent';
  doNotDisturb: boolean;
};

// What playing the ring did (row 84): it played, the ringer was not on, or the
// rider chose None as the sound of the "New offers" alert kind.
export type OfferSoundOutcome = 'played' | 'silenced' | 'no_sound';

// The shape of what the Kotlin module offers to JavaScript.
type OfferAlertNativeModule = {
  getRingerState: () => Promise<RingerState>;
  canUseFullScreenAlert: () => Promise<boolean>;
  openFullScreenAlertSettings: () => void;
  openSoundSettings: () => void;
  playOfferSound: () => Promise<OfferSoundOutcome>;
  isAlertScreenInFront: () => Promise<boolean>;
  closeAlertScreen: () => void;
  openApp: () => void;
};

// `NativeModules` holds every native module by name; `as ... | undefined`
// says it may be missing (see the top of this file).
const native = (): OfferAlertNativeModule | undefined =>
  Platform.OS === 'android'
    ? (NativeModules.OfferAlert as OfferAlertNativeModule | undefined)
    : undefined;

const NORMAL: RingerState = { ringerMode: 'normal', doNotDisturb: false };

// Read at the moment it is asked; never stored or sent (AC-8, value 5).
export const getRingerState = async (): Promise<RingerState> => {
  try {
    return (await native()?.getRingerState()) ?? NORMAL;
  } catch {
    return NORMAL;
  }
};

// True when the phone will not ring for an offer: silent, vibrate only, or
// Do Not Disturb in any form.
export const isPhoneSilenced = (state: RingerState): boolean =>
  state.ringerMode !== 'normal' || state.doNotDisturb;

export const canUseFullScreenAlert = async (): Promise<boolean> => {
  try {
    return (await native()?.canUseFullScreenAlert()) ?? true;
  } catch {
    return true;
  }
};

export const openFullScreenAlertSettings = () =>
  native()?.openFullScreenAlertSettings();

export const openSoundSettings = () => native()?.openSoundSettings();

// The offer ring, once, when the offers list on screen shows a new offer, and
// for the Play button. Row 84: the sound is the one the rider chose for the
// "New offers" alert kind in Android, else the co-op's ring. With no module (or
// an app built before row 84, whose method answers nothing) it reports
// "played", as every function here reports "all fine".
export const playOfferSound = async (): Promise<OfferSoundOutcome> => {
  try {
    return (await native()?.playOfferSound()) ?? 'played';
  } catch {
    return 'played';
  }
};

// True while the offer screen (OfferAlertActivity) is in front. React Native
// calls the app "active" whichever of its screens is in front, so "the offers
// list is in front" must also mean "the offer screen is not".
export const isAlertScreenInFront = async (): Promise<boolean> => {
  try {
    return (await native()?.isAlertScreenInFront()) ?? false;
  } catch {
    return false;
  }
};

// Sent by the Kotlin module when an alert opens the offer screen while it is
// already up (it is reused, not opened afresh). Same name as there.
const ALERT_SCREEN_REOPENED = 'OfferAlertScreenReopened';

// Calls `onReopened` with the alert's id (or null if Android did not pass it)
// each time that happens. Returns the function that stops listening.
export const onAlertScreenReopened = (
  onReopened: (notificationId: string | null) => void,
): (() => void) => {
  const subscription = DeviceEventEmitter.addListener(
    ALERT_SCREEN_REOPENED,
    (notificationId?: string | null) => onReopened(notificationId ?? null),
  );
  return () => subscription.remove();
};

// The offer screen (OfferAlertActivity) closes itself, or opens the app.
export const closeAlertScreen = () => native()?.closeAlertScreen();
export const openAppFromAlert = () => native()?.openApp();
