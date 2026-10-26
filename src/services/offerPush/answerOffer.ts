// Accept or decline an offer from its alert (row 58, spec 0003, AC-5).
//
// This can run with no screen at all: Android wakes the app's JavaScript just
// to handle a button press on a locked phone. So it relies on nothing the
// screens set up. It reads the instance address (`BASE_URL`) and the login
// (`token`) from storage itself, because the shared HTTP client only learns
// its address on the startup screens.
//
// It sends exactly what the app's own Accept and Decline send
// (`orderService.acceptOrder` and `declineOrder`). The rider's own tap is the
// only thing that answers: nothing here answers on a timer or by itself.

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import i18next from 'i18next';
import { isOfferEndedError } from '@app/services/orderService';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  loadAnsweredOffers,
  markOfferAnswered,
  offerKeyOf,
  unmarkOfferAnswered,
} from './answeredOffers';
import { cancelOfferAlert, showOfferNotice } from './offerAlert';
import { StoredOfferAlert } from './offerMessage';

export type OfferAnswer = 'accept' | 'decline';

// What happened, for whoever called (the offer screen closes on any of them).
export type AnswerOutcome = 'sent' | 'already-answered' | 'ended' | 'failed';

const REQUEST_TIMEOUT_MS = 10000;

export const answerOffer = async (
  offer: Pick<StoredOfferAlert, 'deliveryId' | 'offeredAt'>,
  answer: OfferAnswer,
): Promise<AnswerOutcome> => {
  // The alert goes at once, so the ring stops the moment the rider taps.
  await cancelOfferAlert(offer.deliveryId);

  // At most one answer per offer from this phone, whether it came from this
  // button or from a tap in the app (the server is the real guarantee).
  await loadAnsweredOffers();
  const key = offerKeyOf(offer.deliveryId, offer.offeredAt);
  if (!markOfferAnswered(key)) {
    return 'already-answered';
  }

  const [baseURL, token] = await Promise.all([
    AsyncStorage.getItem('BASE_URL'),
    AsyncStorage.getItem('token'),
  ]);
  if (!baseURL || !token) {
    // Logged out since the alert was posted: there is nobody to answer for.
    return 'failed';
  }

  const api = axios.create({
    baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const path = `deliveries/${offer.deliveryId}`;

  try {
    if (answer === 'accept') {
      await api.post(`${path}/accept`, {});
      await api.post(`${path}/mark-as-dispatched`, {});
    } else {
      await api.post(`${path}/reject`, {});
    }
    refreshOpenApp();
    return 'sent';
  } catch (error) {
    if (isOfferEndedError(error)) {
      // 409: the offer had already ended (expired, moved, rider Offline).
      // Nothing more is sent; one short notice says why the alert went.
      await showOfferNotice(offer, i18next.t('translations:offer_has_ended'));
      refreshOpenApp();
      return 'ended';
    }
    // No network, for example. Let the rider try again from the app, which
    // still lists the offer.
    unmarkOfferAnswered(key);
    await showOfferNotice(
      offer,
      i18next.t('translations:offer_alert_answer_failed'),
    );
    refreshOpenApp();
    return 'failed';
  }
};

// If the app is open behind the alert, its lists catch up now. With no app
// open the cache is empty and this does nothing.
const refreshOpenApp = () => {
  queryClient.invalidateQueries({ queryKey: [QueryKeys.newOrders] });
  queryClient.invalidateQueries({ queryKey: [QueryKeys.inProgressOrders] });
};
