// Tells the backend where to push this rider's offers (row 58, spec 0003,
// AC-1): this phone's FCM token, sent on login (and on every start while
// logged in, which changes nothing on the server) and again whenever Firebase
// hands the app a new token. Logout takes it back off.
//
// Until the co-op has its own Firebase project (row 1) the token belongs to
// upstream's project, and the backend cannot push to it; registering is still
// right, so everything works the day the project is swapped in.

import { useEffect } from 'react';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { services } from '@app/services/service';

const register = async (token: string) => {
  try {
    await services.notificationDeviceService.registerDevice(token);
  } catch (error) {
    // No network, or an older server without the endpoint: offers still
    // arrive over the live connection. The next start or refresh tries again.
    console.log('Could not register this phone for offer alerts', error);
  }
};

// Used by the root navigator. `userId` is set once a rider is logged in.
export const useOfferPushRegistration = (userId: string | undefined) => {
  useEffect(() => {
    // Only Android for now (iPhone is row 59), and only with someone logged in.
    if (Platform.OS !== 'android' || !userId) {
      return;
    }
    let cancelled = false;
    messaging()
      .getToken()
      .then(token => {
        if (!cancelled && token) {
          register(token);
        }
      })
      .catch(error => console.log('No push token on this phone', error));

    // Firebase can replace the token at any time (an app update, a reset).
    // `onTokenRefresh` returns the function that stops listening, which the
    // effect hands back to React to call when the rider logs out.
    const stopListening = messaging().onTokenRefresh(token => register(token));
    return () => {
      cancelled = true;
      stopListening();
    };
  }, [userId]);
};

// Logging out: take this phone's token off the rider, so the next person to
// log in on it does not get their offers. Gives up after `timeoutMs`, as the
// rest of logout does: a phone with no network still logs out, and the token
// is harmless then, because logout also sets the rider Offline and offers go
// only to Online riders. The next login moves it to whoever logs in.
export const unregisterThisPhone = async (timeoutMs: number): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    // `Promise.race` takes whichever finishes first: the token, or the
    // timeout's `null`, so a stuck Firebase call cannot hold logout up.
    const token = await Promise.race([
      messaging().getToken(),
      new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (token) {
      await services.notificationDeviceService.unregisterDevice(token, {
        timeoutMs,
      });
    }
  } catch (error) {
    console.log('Could not unregister this phone from offer alerts', error);
  }
};
