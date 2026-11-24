// What the phone does with each push message and each alert button
// (row 58, spec 0003). `index.js` wires these up before the app's screens
// exist, so they also run headless: with the app closed, Android starts the
// app's JavaScript just to run them, and no screen is drawn.
//
// Push never decides anything. It only shows, replaces or removes an alert
// about an offer the server has already made, ended or recorded.

import { parseJobReadyUpdate } from '@app/utilities/readySignals';
import { showReadyNotice } from '@app/services/readyNotice/readyNotice';
import { receiveRemovalDecision } from '@app/services/removalNotice/removalNotice';
import { receiveSplitDecision } from '@app/services/splitNotice/splitNotice';
import { AppState } from 'react-native';
import { languageReady } from '@app/localization/i18n';
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
  markOfferEnded,
  offerKeyOf,
} from './answeredOffers';
import { answerOffer } from './answerOffer';
import { onOnlineSignDismissed } from '@app/services/onlineService';
import { alertNewCancelledJobs } from '@app/services/cancelledJobs/cancelledJobs';
import {
  noticeChatMessage,
  openChatFromNotice,
} from '@app/services/chat/chatNotice';
import {
  REVIEW_ANSWERED_TYPE,
  openReviewsFromNotice,
  receiveReviewAnswer,
} from '@app/services/reviewNotice';
import {
  COMPLAINT_NEEDS_REPLY_TYPE,
  openComplaintsFromNotice,
  receiveComplaintNeedsReply,
} from '@app/services/complaintNotice';

// Where the message was caught: `onMessage` (the app open in front) or
// `setBackgroundMessageHandler` (closed, in the background, or locked).
export type ReceivedWhere = 'foreground' | 'background';

export const onRemoteMessage = async (
  message: FirebaseMessagingTypes.RemoteMessage,
  where: ReceivedWhere,
): Promise<void> => {
  const receivedAt = Date.now();
  // Started by Android only to handle this push, the app may not have read the saved language yet:
  // wait for it, so the notice is worded in the rider's language (spec 0054, AC-5).
  await languageReady.catch(() => undefined);
  // Spec 0015: a job this rider held was cancelled. Only its id travels; the alert says to open
  // the app, which reads the rest from its own route. Once per job, shared with the open app.
  if (message.data?.type === 'JOB_CANCELLED') {
    const deliveryId = message.data.deliveryId;
    if (
      typeof deliveryId === 'string' &&
      (await AsyncStorage.getItem('token'))
    ) {
      await alertNewCancelledJobs([{ id: deliveryId, pickupBusinessName: '' }]);
      queryClient.invalidateQueries({ queryKey: [QueryKeys.cancelledJobs] });
    }
    return;
  }
  // Spec 0023 (AC-6): a held job's ready time changed. The push carries the
  // same fields as the live message, so the notice is worded from it.
  if (message.data?.type === 'JOB_READY_UPDATED') {
    const update = parseJobReadyUpdate(message.data);
    if (update && (await AsyncStorage.getItem('token'))) {
      // A notice that cannot be posted (no permission) must not stop the refetch.
      await showReadyNotice(update).catch(error =>
        console.log('Could not show the ready notice', error),
      );
      queryClient.invalidateQueries({ queryKey: [QueryKeys.inProgressOrders] });
    }
    return;
  }
  // Spec 0035 (AC-11): dispatch answered a removal request. Only a phone still logged in shows it.
  if (message.data?.type === 'REMOVAL_REQUEST_DECIDED') {
    if (await AsyncStorage.getItem('token')) {
      await receiveRemovalDecision(message.data, queryClient).catch(error =>
        console.log('Could not show the removal notice', error),
      );
    }
    return;
  }
  // Spec 0047 (cross check 12): dispatch answered a split request, shown as a removal answer is.
  if (message.data?.type === 'SPLIT_REQUEST_DECIDED') {
    if (await AsyncStorage.getItem('token')) {
      await receiveSplitDecision(message.data, queryClient).catch(error =>
        console.log('Could not show the split notice', error),
      );
    }
    return;
  }
  // Spec 0034 (AC-11): dispatch wrote. The push holds no text: the phone draws its own "New message
  // from Dispatch" line, in front too, unless Chat is on screen or the rider is Offline (chatNotice.ts).
  if (message.data?.type === 'CHAT_MESSAGE') {
    if (await AsyncStorage.getItem('token')) {
      await noticeChatMessage().catch(error =>
        console.log('Could not show the chat notice', error),
      );
      queryClient.invalidateQueries({ queryKey: [QueryKeys.chatMessages] });
    }
    return;
  }
  // Spec 0038 (AC-9): a person answered a review request. Only the request id travels; the phone draws
  // a fixed line on chat's quiet channel and the page reads the answer from the server.
  if (message.data?.type === REVIEW_ANSWERED_TYPE) {
    if (await AsyncStorage.getItem('token')) {
      await receiveReviewAnswer().catch(error =>
        console.log('Could not show the review notice', error),
      );
    }
    return;
  }
  // Spec 0052 (AC-4): a complaint about this rider needs their reply. Only the complaint id travels;
  // the phone draws a fixed line on chat's quiet channel, Online or not (complaintNotice.ts).
  if (message.data?.type === COMPLAINT_NEEDS_REPLY_TYPE) {
    if (await AsyncStorage.getItem('token')) {
      await receiveComplaintNeedsReply().catch(error =>
        console.log('Could not show the complaint notice', error),
      );
    }
    return;
  }
  const parsed = parseOfferMessage(message.data);
  if (parsed === null) {
    return;
  }

  if (parsed.kind === 'ended') {
    // AC-6: the offer ended on the server. The alert and its ring stop on
    // every phone of this rider; the open app drops the offer at once.
    // Row 155: a late push of this very offer will not ring either.
    await markOfferEnded(parsed.deliveryId, parsed.offeredAt).catch(error =>
      console.log('Could not keep the ended offer', error),
    );
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
  if (appInFront && (await isHomeInFront())) {
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
  // As above: a button pressed on a notice can start the app with nothing read yet.
  await languageReady.catch(() => undefined);
  if (type === EventType.DISMISSED) {
    // The "online" sign is never left swiped away while tracking (row 68).
    await onOnlineSignDismissed(detail.notification?.id);
    return;
  }
  // A tap on the chat notice opens the chat (spec 0034).
  if (
    type === EventType.PRESS &&
    detail.notification?.data?.type === 'CHAT_MESSAGE'
  ) {
    openChatFromNotice();
    return;
  }
  // A tap on the review answer notice opens the page with the rider's requests (spec 0038).
  if (
    type === EventType.PRESS &&
    detail.notification?.data?.type === REVIEW_ANSWERED_TYPE
  ) {
    openReviewsFromNotice();
    return;
  }
  // A tap on the complaint notice opens the Complaints screen (spec 0052).
  if (
    type === EventType.PRESS &&
    detail.notification?.data?.type === COMPLAINT_NEEDS_REPLY_TYPE
  ) {
    openComplaintsFromNotice();
    return;
  }
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
