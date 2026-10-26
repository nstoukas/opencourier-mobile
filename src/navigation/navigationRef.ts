import { AppState } from 'react-native';
import { createNavigationContainerRef } from '@react-navigation/native';
import { DrawerScreens } from './drawer/types';
import { isAlertScreenInFront } from '@app/services/offerPush/phone';

// A handle on the app's navigator that works outside any screen (row 58). The
// push handler uses it to ask which screen is in front: on the offers list an
// offer needs no system alert, because the list already shows it (AC-12).
export const navigationRef = createNavigationContainerRef();

// True when the app's home screen (the offers list) is the screen in front:
// the app is open and active, the navigator is on Home, and the offer screen
// (its own Android activity) is not open over it.
export const isHomeInFront = async (): Promise<boolean> =>
  AppState.currentState === 'active' &&
  navigationRef.isReady() &&
  navigationRef.getCurrentRoute()?.name === DrawerScreens.Home &&
  !(await isAlertScreenInFront());
