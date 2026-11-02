import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import ActionSheet from 'react-native-action-sheet';
import { useTranslation } from 'react-i18next';
import { MapLinkingOptions } from '@app/types/types';
import { RoutePoint } from '@app/types/route';
import { mapAppsFor, mapProbeUrl, mapRouteUrl } from '@app/utilities/mapLinks';
import {
  getNavigationApp,
  setNavigationApp,
} from '@app/services/mapPreferences';
import { color } from '@app/styles/theme';

// The navigation apps this phone has, in the usual order (row 66's probe).
export const installedNavigationApps = async (): Promise<
  MapLinkingOptions[]
> => {
  const installed: MapLinkingOptions[] = [];
  for (const app of mapAppsFor()) {
    if (await Linking.canOpenURL(mapProbeUrl(app))) {
      installed.push(app);
    }
  }
  return installed;
};

const open = (app: MapLinkingOptions, point: RoutePoint) =>
  Linking.openURL(mapRouteUrl(app, point)).catch(error =>
    console.log('Could not open the map app', error),
  );

// Shows the installed apps and calls back with the one picked (nothing on
// Cancel).
const pickNavigationApp = (
  installed: MapLinkingOptions[],
  t: (key: string) => string,
  onPick: (app: MapLinkingOptions) => void,
) => {
  const options = [
    ...installed.map(app => t(`translations:${app}`)),
    t('translations:cancel'),
  ];
  ActionSheet.showActionSheetWithOptions(
    {
      title: t('translations:navigation_app_title'),
      options,
      cancelButtonIndex: options.length - 1,
      tintColor: color.route,
      cancelButtonTintColor: color.destructive,
    },
    (index: number) => {
      if (index < installed.length) {
        onPick(installed[index]);
      }
    },
  );
};

// Spec 0018 (AC-12): one tap opens the rider's saved navigation app toward
// `point`. With none saved, or when that app is gone from the phone, it asks
// among the installed ones and remembers the pick. There is no turn by turn
// inside this app.
export const useNavigateTo = () => {
  const { t } = useTranslation();
  return useCallback(
    async (point: RoutePoint) => {
      const saved = await getNavigationApp();
      if (saved !== null && (await Linking.canOpenURL(mapProbeUrl(saved)))) {
        open(saved, point);
        return;
      }
      const installed = await installedNavigationApps();
      if (installed.length === 0) {
        Alert.alert(t('translations:navigation_app_none'));
        return;
      }
      pickNavigationApp(installed, t, app => {
        setNavigationApp(app).catch(() => undefined);
        open(app, point);
      });
    },
    [t],
  );
};
