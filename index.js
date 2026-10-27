import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import {
  onNotificationEvent,
  onRemoteMessage,
} from '@app/services/offerPush/pushHandlers';
import { OfferAlertScreen } from '@app/screens/OfferAlert/OfferAlertScreen';
import './src/localization/i18n';

// Offer push (row 58, spec 0003). These are registered here, before any
// screen, so they also work when Android starts the app only to handle a push
// or a button press, with nothing on screen.
messaging().onMessage(message => onRemoteMessage(message, 'foreground'));
messaging().setBackgroundMessageHandler(message =>
  onRemoteMessage(message, 'background'),
);
notifee.onBackgroundEvent(onNotificationEvent);
notifee.onForegroundEvent(onNotificationEvent);
// The "online" foreground service (row 68). Its task never finishes, so the
// service lives until the app stops it (stopForegroundService) when tracking ends.
// Do not make it resolve: notifee would then stop the service, and the location
// sharing with it, while the rider is still Online.
notifee.registerForegroundService(() => new Promise(() => {}));

AppRegistry.registerComponent(appName, () => App);
// The offer screen an alert opens, drawn by OfferAlertActivity on its own.
AppRegistry.registerComponent('OfferAlert', () => OfferAlertScreen);
