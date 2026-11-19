import UserContext from '@app/context/userContext';
import { useContext, useEffect, useCallback } from 'react';
import Geolocation from 'react-native-geolocation-service';
import { requestAndroidPermission } from '@app/utilities/permissions';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';

export const useLocationPermission = (
  autoRequestPermission: boolean = false,
) => {
  const { locationPermission, setLocationPermission } = useContext(UserContext);

  // Asks for location and answers whether the app may use it (row 17, spec
  // 0039, AC-16: going Online needs the answer). With `openSettingsIfBlocked`,
  // an Android "don't ask again" opens this app's page in the phone's settings,
  // the only place left where the rider can allow it (AC-15).
  const requestLocationPermission = useCallback(
    async (
      options: { openSettingsIfBlocked?: boolean } = {},
    ): Promise<boolean> => {
      if (Platform.OS === 'ios') {
        // Answers at once, with no prompt, when location is already allowed.
        const permission = await Geolocation.requestAuthorization('whenInUse');
        const granted = permission === 'granted';
        if (granted) {
          setLocationPermission(true);
        }
        return granted;
      }
      if (Platform.OS !== 'android') {
        return false;
      }
      const answer = await requestAndroidPermission(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      const granted = answer === 'granted';
      if (granted) {
        await requestAndroidPermission(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        );
      } else if (answer === 'blocked' && options.openSettingsIfBlocked) {
        Linking.openSettings().catch(() => undefined);
      }
      setLocationPermission(granted);
      return granted;
    },
    [setLocationPermission],
  );

  useEffect(() => {
    if (autoRequestPermission) {
      requestLocationPermission();
    }
  }, [autoRequestPermission, requestLocationPermission]);

  return {
    requestLocationPermission,
    locationPermission,
  };
};

// Keeps the shared location permission flag in step with what the phone has
// granted (row 67).
export const useGrantedLocationPermission = () => {
  const { setLocationPermission } = useContext(UserContext);

  // Reads what the phone has already granted, without asking (row 67). Before,
  // the app knew it had location only after asking in the same run, so after
  // a restart it never tracked at all. Read again each time the app comes
  // back, so a permission switched off in the phone's settings stops tracking.
  // iOS keeps its old behaviour until it can be checked on a Mac (row 85).
  // Called once, by the Router, so there is one reader and one listener.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const readGranted = () =>
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      )
        .then(granted => setLocationPermission(granted))
        .catch(() => undefined);
    readGranted();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        readGranted();
      }
    });
    return () => subscription.remove();
  }, [setLocationPermission]);
};
