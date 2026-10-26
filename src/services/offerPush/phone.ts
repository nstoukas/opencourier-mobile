// The app's own small Android module for offer alerts (row 58, spec 0003),
// `android/app/src/main/java/com/opendeli/OfferAlertModule.kt`. It reads the
// ringer and Do Not Disturb, says whether full screen alerts are allowed, and
// opens Android's settings screens. It never changes a setting by itself.
//
// On iPhone (row 59), in tests, or on an app built before the module existed,
// the module is missing: every function below then does nothing and reports
// "all fine", so going Online never gets stuck on a missing module.

import { NativeModules, Platform } from 'react-native';

export type RingerState = {
  ringerMode: 'normal' | 'vibrate' | 'silent';
  doNotDisturb: boolean;
};

// The shape of what the Kotlin module offers to JavaScript.
type OfferAlertNativeModule = {
  getRingerState: () => Promise<RingerState>;
  canUseFullScreenAlert: () => Promise<boolean>;
  openFullScreenAlertSettings: () => void;
  openSoundSettings: () => void;
  playOfferSound: () => void;
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

// The offer ring, once, when the offers list on screen shows a new offer.
export const playOfferSound = () => native()?.playOfferSound();

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

// The offer screen (OfferAlertActivity) closes itself, or opens the app.
export const closeAlertScreen = () => native()?.closeAlertScreen();
export const openAppFromAlert = () => native()?.openApp();
