// What happens as a rider goes Online (row 58, spec 0003, AC-8, AC-9).
//
// 1. The first time only: ask for notification permission, and on Android 14
//    and later explain and open the full screen alert setting. Saying no
//    still lets the rider work: offers then come as a normal alert, or only
//    in the app's list and over the live connection.
// 2. Every time: if the phone is on silent, vibrate only, or Do Not Disturb,
//    warn "Your phone is on silent. You may miss offers." with "Turn sound on"
//    and "Go Online anyway".
//
// The rider decides; both answers go Online. Nothing here is recorded or sent
// anywhere (value 5): the ringer is read at the moment of the tap and
// forgotten.

import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';
import {
  canUseFullScreenAlert,
  getRingerState,
  isPhoneSilenced,
  openFullScreenAlertSettings,
  openSoundSettings,
} from './phone';

// Set once the first time questions have been asked, so they are not asked
// again. Kept on this phone only.
const ASKED_KEY = 'offer_alert_permissions_asked';

// After a button opens one of Android's settings screens, wait until the
// rider is back in the app. A dialog started while the app is leaving the
// screen is dropped by Android without a word, which would leave the rider
// stuck before going Online. If the app never leaves (the settings screen did
// not open), carry on after a moment.
const SETTINGS_OPEN_WAIT_MS = 1500;
const untilBackInApp = (): Promise<void> =>
  new Promise(resolve => {
    let left = false;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        left = true;
      } else if (left) {
        subscription.remove();
        resolve();
      }
    });
    setTimeout(() => {
      if (!left) {
        subscription.remove();
        resolve();
      }
    }, SETTINGS_OPEN_WAIT_MS);
  });

type Choice = { text: string; opensSettings?: () => void };

// A two button question that waits for the rider's answer. `new Promise`
// turns the dialog's button callbacks into something `await` can wait for.
const ask = (
  title: string,
  message: string,
  first: Choice,
  second: Choice,
): Promise<void> =>
  new Promise(resolve => {
    const answer = (choice: Choice) => () => {
      if (choice.opensSettings) {
        choice.opensSettings();
        untilBackInApp().then(resolve);
      } else {
        resolve();
      }
    };
    Alert.alert(
      title,
      message,
      [
        { text: first.text, onPress: answer(first) },
        { text: second.text, onPress: answer(second) },
      ],
      // Tapping outside the dialog also counts as an answer: carry on.
      { cancelable: true, onDismiss: () => resolve() },
    );
  });

const askAlertPermissionsOnce = async () => {
  const asked = await AsyncStorage.getItem(ASKED_KEY).catch(() => null);
  if (asked === 'yes') {
    return;
  }
  await AsyncStorage.setItem(ASKED_KEY, 'yes').catch(() => undefined);

  // Android 13 and later need the rider's yes for notifications: ask with
  // Android's own dialog, only if not given yet. (Earlier versions allow them
  // already.) React Native's PermissionsAndroid is used rather than notifee's
  // requestPermission, which never answered on a phone that had already said
  // yes, and so stopped the rider from going Online.
  if (Number(Platform.Version) >= 33) {
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    const granted = await PermissionsAndroid.check(permission);
    if (!granted) {
      await PermissionsAndroid.request(permission);
    }
  }

  if (!(await canUseFullScreenAlert())) {
    await ask(
      i18next.t('translations:full_screen_title'),
      i18next.t('translations:full_screen_message'),
      { text: i18next.t('translations:not_now') },
      {
        text: i18next.t('translations:full_screen_open_settings'),
        opensSettings: openFullScreenAlertSettings,
      },
    );
  }
};

const warnIfSilenced = async () => {
  if (!isPhoneSilenced(await getRingerState())) {
    return;
  }
  // The spec's own words, as the dialog's only text. The title is left empty
  // (Android then draws none); an empty message would leave a blank gap.
  await ask(
    '',
    i18next.t('translations:phone_silent_message'),
    { text: i18next.t('translations:phone_silent_go_anyway') },
    {
      // Opens Android's sound settings; the rider still goes Online.
      text: i18next.t('translations:phone_silent_turn_on'),
      opensSettings: openSoundSettings,
    },
  );
};

// Call just before setting the rider Online. Resolves once the rider has
// answered whatever was asked (often nothing).
export const prepareToGoOnline = async (): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    await askAlertPermissionsOnce();
    await warnIfSilenced();
  } catch (error) {
    // A check that fails must never keep a rider from working.
    console.log('Going Online checks failed', error);
  }
};
