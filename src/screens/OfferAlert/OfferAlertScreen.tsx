// The offer screen an alert opens (row 58, spec 0003, AC-4, AC-5).
//
// Drawn by OfferAlertActivity, on its own: no navigator, no login check, no
// data fetch. Everything on it comes from the alert's own data, so it shows
// at once, even over the lock screen with no network. It only holds the offer
// card's facts (AC-10), never the customer's details.
//
// Accept and Decline here go through the same `answerOffer` as the alert's
// buttons, so an offer is answered at most once from this phone.

import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import notifee from '@notifee/react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '@app/styles/colors';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  fromNotificationData,
  StoredOfferAlert,
} from '@app/services/offerPush/offerMessage';
import {
  displayedOfferAlerts,
  offerSummary,
  payText,
} from '@app/services/offerPush/offerAlert';
import { answerOffer, OfferAnswer } from '@app/services/offerPush/answerOffer';
import {
  closeAlertScreen,
  openAppFromAlert,
} from '@app/services/offerPush/phone';

// Which offer to show: the alert that opened this screen, or, if Android did
// not pass it along, the newest offer alert still on display.
const findOffer = async (): Promise<StoredOfferAlert | null> => {
  const initial = await notifee.getInitialNotification().catch(() => null);
  const fromInitial = fromNotificationData(initial?.notification.data);
  if (fromInitial !== null) {
    return fromInitial;
  }
  // Android can add a summary of its own (it groups an app's notifications)
  // on the same channel, with no offer data: only real offer alerts count.
  const offers = (await displayedOfferAlerts())
    .map(alert => fromNotificationData(alert.data))
    // `offer is StoredOfferAlert` tells TypeScript the kept items are never
    // null, so the list's type loses its `| null`.
    .filter((offer): offer is StoredOfferAlert => offer !== null);
  return offers[offers.length - 1] ?? null;
};

// How often the screen redraws its countdown and checks the alert is still up.
const TICK_MS = 1000;

export const OfferAlertScreen = () => {
  const { t } = useTranslation();
  // `undefined` while looking, `null` when there is no offer (it ended).
  const [offer, setOffer] = useState<StoredOfferAlert | null | undefined>(
    undefined,
  );
  const [now, setNow] = useState(Date.now());
  const [sending, setSending] = useState(false);
  // Read inside the timer below, which keeps its first render's values.
  const offerRef = useRef<StoredOfferAlert | null | undefined>(undefined);
  offerRef.current = offer;

  useEffect(() => {
    findOffer().then(setOffer);
    // The app, if it is open behind this screen, fetches its offers now.
    queryClient.invalidateQueries({ queryKey: [QueryKeys.newOrders] });
  }, []);

  // Every second: redraw the countdown, and notice when the alert is gone
  // (the offer ended, or was answered from the app or another phone).
  useEffect(() => {
    const timer = setInterval(async () => {
      setNow(Date.now());
      const shown = offerRef.current;
      if (!shown) {
        return;
      }
      const displayed = await displayedOfferAlerts();
      if (!displayed.some(alert => alert.notificationId === shown.deliveryId)) {
        setOffer(null);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const answer = async (choice: OfferAnswer) => {
    if (!offer || sending) {
      return;
    }
    setSending(true);
    // Whatever the outcome, this screen's work is done: a notice explains a
    // failure, and the app still lists an offer it could not answer.
    await answerOffer(offer, choice);
    closeAlertScreen();
  };

  if (offer === undefined) {
    return <SafeAreaView style={styles.container} />;
  }

  if (offer === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('translations:offer_has_ended')}</Text>
        </View>
        <TouchableOpacity style={styles.secondary} onPress={closeAlertScreen}>
          <Text style={styles.secondaryText}>
            {t('translations:offer_alert_close')}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const secondsLeft =
    offer.deadlineAt === null
      ? null
      : Math.max(0, Math.ceil((offer.deadlineAt - now) / 1000));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.pay}>{payText(offer)}</Text>
        <Text style={styles.summary}>{offerSummary(offer)}</Text>
        <Text style={styles.time}>
          {secondsLeft === null
            ? t('translations:offer_alert_no_deadline')
            : t('translations:offer_alert_time_left', {
                seconds: secondsLeft,
              })}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.button, styles.accept]}
        disabled={sending}
        onPress={() => answer('accept')}>
        <Text style={styles.buttonText}>{t('translations:accept')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.decline]}
        disabled={sending}
        onPress={() => answer('decline')}>
        <Text style={styles.buttonText}>{t('translations:decline')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={openAppFromAlert}>
        <Text style={styles.secondaryText}>
          {t('translations:offer_alert_open_app')}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black6,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  pay: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.black6,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.black6,
  },
  summary: {
    fontSize: 20,
    marginTop: 12,
    color: Colors.black1,
  },
  time: {
    fontSize: 18,
    marginTop: 16,
    color: Colors.gray13,
  },
  button: {
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  accept: {
    backgroundColor: Colors.green2,
  },
  decline: {
    backgroundColor: Colors.red7,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '700',
  },
  secondary: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: {
    color: Colors.white,
    fontSize: 18,
    textDecorationLine: 'underline',
  },
});
