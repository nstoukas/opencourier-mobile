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

import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
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

// A two button question that waits for the rider's answer. `new Promise`
// turns the dialog's button callbacks into something `await` can wait for.
const ask = (
  title: string,
  message: string,
  first: { text: string; onPress?: () => void },
  second: { text: string; onPress?: () => void },
): Promise<void> =>
  new Promise(resolve => {
    Alert.alert(
      title,
      message,
      [
        {
          text: first.text,
          onPress: () => {
            first.onPress?.();
            resolve();
          },
        },
        {
          text: second.text,
          onPress: () => {
            second.onPress?.();
            resolve();
          },
        },
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

  // Android 13 and later show their own "Allow notifications?" dialog here;
  // earlier versions allow notifications already and show nothing.
  await notifee.requestPermission().catch(() => undefined);

  if (!(await canUseFullScreenAlert())) {
    await ask(
      i18next.t('translations:full_screen_title'),
      i18next.t('translations:full_screen_message'),
      { text: i18next.t('translations:not_now') },
      {
        text: i18next.t('translations:full_screen_open_settings'),
        onPress: openFullScreenAlertSettings,
      },
    );
  }
};

const warnIfSilenced = async () => {
  if (!isPhoneSilenced(await getRingerState())) {
    return;
  }
  // The spec's own words, as the dialog's only text.
  await ask(
    i18next.t('translations:phone_silent_message'),
    '',
    { text: i18next.t('translations:phone_silent_go_anyway') },
    {
      // Opens Android's sound settings; the rider still goes Online.
      text: i18next.t('translations:phone_silent_turn_on'),
      onPress: openSoundSettings,
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
