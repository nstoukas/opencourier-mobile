import { Alert, Linking } from 'react-native';
import i18n from '@app/localization/i18n';
import { isLocationGranted } from '@app/utilities/permissions';

// Row 17 (spec 0039, AC-16): dispatch can only offer jobs to a rider whose
// position it has, so going Online needs location. Before, a rider without it
// sat Online and silently got nothing. The position is still used only to
// dispatch and deliver (value 5); nothing here records the answer.

// Explains why the rider is Offline, with a way to the phone's settings.
export const showLocationOffAlert = (): void => {
  Alert.alert(
    i18n.t('translations:location_off_title'),
    i18n.t('translations:location_off_online'),
    [
      { text: i18n.t('translations:not_now'), style: 'cancel' },
      {
        text: i18n.t('translations:open_settings'),
        onPress: () => {
          Linking.openSettings().catch(() => undefined);
        },
      },
    ],
  );
};

// True when the rider may go Online. Asks for location if it is not allowed;
// refused, shows why and answers false (the rider stays Offline).
// `requestLocation` is useLocationPermission's request, so the app's own
// location flag updates too.
export const confirmLocationForOnline = async (
  requestLocation: () => Promise<boolean>,
): Promise<boolean> => {
  // Android can read the answer without asking. iOS answers at once, with no
  // prompt, when location is already allowed.
  if ((await isLocationGranted()) === true) {
    return true;
  }
  if (await requestLocation()) {
    return true;
  }
  showLocationOffAlert();
  return false;
};
