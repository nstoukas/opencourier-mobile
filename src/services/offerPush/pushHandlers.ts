// What the phone does with each push message and each alert button
// (row 58, spec 0003). `index.js` wires these up before the app's screens
// exist, so they also run headless: with the app closed, Android starts the
// app's JavaScript just to run them, and no screen is drawn.
//
// Push never decides anything. It only shows, replaces or removes an alert
// about an offer the server has already made, ended or recorded.

import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// `type` brings in only the TypeScript description of these, no code.
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { EventType, type Event } from '@notifee/react-native';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import { Order } from '@app/types/types';
import { isHomeInFront } from '@app/navigation/navigationRef';
import { fromNotificationData, parseOfferMessage } from './offerMessage';
import {
  ACCEPT_ACTION,
  cancelOfferAlert,
  DECLINE_ACTION,
  showOfferAlert,
} from './offerAlert';
import {
  isOfferAnswered,
  loadAnsweredOffers,
  offerKeyOf,
} from './answeredOffers';
import { answerOffer } from './answerOffer';

// Where the message was caught: `onMessage` (the app open in front) or
// `setBackgroundMessageHandler` (closed, in the background, or locked).
export type ReceivedWhere = 'foreground' | 'background';

export const onRemoteMessage = async (
  message: FirebaseMessagingTypes.RemoteMessage,
  where: ReceivedWhere,
): Promise<void> => {
  const receivedAt = Date.now();
  const parsed = parseOfferMessage(message.data);
  if (parsed === null) {
    return;
  }

  if (parsed.kind === 'ended') {
    // AC-6: the offer ended on the server. The alert and its ring stop on
    // every phone of this rider; the open app drops the offer at once.
    await cancelOfferAlert(parsed.deliveryId);
    queryClient.setQueryData<Order[]>([QueryKeys.newOrders], offers =>
      offers?.filter(offer => offer.id !== parsed.deliveryId),
    );
    queryClient.invalidateQueries({ queryKey: [QueryKeys.newOrders] });
    return;
  }

  const { offer } = parsed;
  // A phone that logged out (and could not tell the server) rings for nobody.
  if (!(await AsyncStorage.getItem('token'))) {
    return;
  }
  // Already answered from this phone (the app, or a button on an earlier
  // alert): the server's re send must not ring again.
  await loadAnsweredOffers();
  if (isOfferAnswered(offerKeyOf(offer.deliveryId, offer.offeredAt))) {
    return;
  }

  // The open app fetches its list now, whichever screen is in front.
  queryClient.invalidateQueries({ queryKey: [QueryKeys.newOrders] });

  const appInFront =
    where === 'foreground' && AppState.currentState === 'active';
  if (appInFront && isHomeInFront()) {
    // AC-12: the offers list is on screen. It shows the offer and rings once
    // when it sees it (useHomeOrders), so no system alert stacks on top.
    return;
  }
  await showOfferAlert(
    offer,
    receivedAt,
    appInFront ? 'heads-up' : 'full-screen',
  );
};

// A press on an alert or on one of its buttons. notifee calls this through
// `onBackgroundEvent` (app closed or in the background) and
// `onForegroundEvent` (app open); both do the same.
export const onNotificationEvent = async ({
  type,
  detail,
}: Event): Promise<void> => {
  if (type !== EventType.ACTION_PRESS) {
    // A tap on the alert itself opens the offer screen (OfferAlertActivity)
    // through the alert's own `pressAction`: nothing to do here.
    return;
  }
  const actionId = detail.pressAction?.id;
  if (actionId !== ACCEPT_ACTION && actionId !== DECLINE_ACTION) {
    return;
  }
  const offer = fromNotificationData(detail.notification?.data);
  if (offer === null) {
    return;
  }
  await answerOffer(offer, actionId === ACCEPT_ACTION ? 'accept' : 'decline');
};
