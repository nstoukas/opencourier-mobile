import {
  AppState,
  Linking,
  Permission,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';

// Row 17 (spec 0039, AC-15, AC-16): what the phone has already allowed, read
// without asking. `null` means "can't tell without asking": iOS, until the
// iOS half is checked on a Mac (row 85). Nothing here is stored or sent
// anywhere (value 5).

// How long to wait for Android's permission dialog to appear. A dialog takes
// the app out of the front at once; when nothing does in this time, the
// permission is blocked ("don't ask again").
export const BLOCKED_DIALOG_WAIT_MS = 1500;

export type AndroidAnswer = 'granted' | 'denied' | 'blocked';

// Asks Android for one permission. Once a rider has chosen "don't ask again",
// Android shows no dialog, and React Native only hands the answer back the next
// time the app comes to the front, so a plain request would wait until then.
// Here no dialog within BLOCKED_DIALOG_WAIT_MS counts as blocked.
export const requestAndroidPermission = (
  permission: Permission,
): Promise<AndroidAnswer> =>
  new Promise(resolve => {
    let settled = false;
    let dialogShown = false;
    const finish = (answer: AndroidAnswer) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      subscription.remove();
      resolve(answer);
    };
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        dialogShown = true;
      }
    });
    const timer = setTimeout(() => {
      if (!dialogShown) {
        finish('blocked');
      }
    }, BLOCKED_DIALOG_WAIT_MS);
    PermissionsAndroid.request(permission)
      .then(answer => {
        if (answer === PermissionsAndroid.RESULTS.GRANTED) {
          finish('granted');
        } else if (answer === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          finish('blocked');
        } else {
          finish('denied');
        }
      })
      .catch(() => finish('denied'));
  });

export const isLocationGranted = async (): Promise<boolean | null> => {
  if (Platform.OS !== 'android') {
    return null;
  }
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
  } catch {
    return false;
  }
};

// Android asks for notifications only from Android 13 (API 33); before that
// they are allowed when the app is installed.
const asksForNotifications = (): boolean => Number(Platform.Version) >= 33;

export const isNotificationsGranted = async (): Promise<boolean | null> => {
  if (Platform.OS !== 'android') {
    return null;
  }
  if (!asksForNotifications()) {
    return true;
  }
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  } catch {
    return false;
  }
};

// Asks for notifications and answers whether they are allowed. An Android
// "don't ask again" opens this app's page in the phone's settings instead.
export const requestNotifications = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    if (!asksForNotifications()) {
      return true;
    }
    const answer = await requestAndroidPermission(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (answer === 'blocked') {
      Linking.openSettings().catch(() => undefined);
    }
    return answer === 'granted';
  }
  try {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  } catch {
    return false;
  }
};
