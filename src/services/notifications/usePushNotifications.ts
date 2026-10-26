import { useState } from 'react';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid } from 'react-native';

// The onboarding slide's "Enable Notifications" button. Registering the
// phone and handling offer pushes moved to `src/services/offerPush/` (row 58).
const usePushNotifications = () => {
  const [permissionsGiven, setPermissionsGiven] = useState<boolean>(false);

  const requestUserPermission = async () => {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      setPermissionsGiven(enabled);
    }

    if (Platform.OS === 'android') {
      const androidApiVersion = Platform.Version?.toString();
      if (androidApiVersion && Number(androidApiVersion) <= 32) {
        const response = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        setPermissionsGiven(response === 'granted');
      } else {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        setPermissionsGiven(enabled);
      }
    }
  };

  return {
    requestUserPermission,
    permissionsGiven,
  };
};

export default usePushNotifications;
