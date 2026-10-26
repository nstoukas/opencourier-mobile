import { Order, UserStatus } from '@app/types/types';
import { services } from '@app/services/service';
import { useEffect, useRef, useState } from 'react';
import { OrderSetting } from '@app/types/enums';
import { filterInProgressOrdersForDisplay } from '@app/utilities/inProgressListFilter';
import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from '@app/utilities/queryKeys';
import useUser from './useUser';
import { OfferCountdowns, OfferTiming } from '@app/utilities/offerCountdowns';
import { isOfferEndedError } from '@app/services/orderService';
import {
  cancelOfferReminder,
  remindRiderOfOffer,
} from '@app/services/offerReminder';
import i18next from 'i18next';
import {
  isOfferAnswered,
  loadAnsweredOffers,
  offerKeyOf,
} from '@app/services/offerPush/answeredOffers';
import { cancelOfferAlert } from '@app/services/offerPush/offerAlert';
import { playOfferSound } from '@app/services/offerPush/phone';
import { isHomeInFront } from '@app/navigation/navigationRef';

// An offer's timing as the countdowns need it (spec 0002).
const offerTimingOf = (order: Order): OfferTiming => ({
  id: order.id,
  offerKey: order.offeredAt ?? null,
  offeredAt: order.phoneClock?.offeredAt ?? null,
  expiresAt: order.phoneClock?.expiresAt ?? null,
});

export const useHomeOrders = () => {
  const queryClient = useQueryClient();
  const [dataSourceNew, setDataSourceNew] = useState<Order[]>([]);
  const [dataSourceInProgress, setDataSourceInProgress] = useState<Order[]>([]);
  const [dataSourceHistory, setDataSourceHistory] = useState<Order[]>([]);

  // quieries

  const {
    data: newOrders,
    isLoading: loadingNewOrders,
    refetch: refetchNew,
  } = useQuery({
    queryFn: services.orderService.getNewOrders,
    queryKey: [QueryKeys.newOrders],
  });

  const {
    data: inProgressOrders,
    isLoading: loadingInProgressOrders,
    refetch: refetchInProgress,
  } = useQuery({
    queryFn: services.orderService.getInProgressOrders,
    queryKey: [QueryKeys.inProgressOrders],
    select: filterInProgressOrdersForDisplay,
  });

  const {
    data: historyOrders,
    isLoading: loadingHistoryOrders,
    refetch: refechHistory,
  } = useQuery({
    queryFn: services.orderService.getOrdersHistory,
    queryKey: [QueryKeys.orderHistory],
  });

  // Bumped by each reminder, so the "Waiting X min" line is drawn again.
  const [, setReminderTick] = useState(0);

  // One countdown per offer (rows 60, 61). `useRef` keeps the same object for
  // the whole life of the screen, so a re-render or a refetch never makes a
  // new one. Its timers fire long after this render, so they call whatever
  // function is in `refetchNewRef` then, not one captured now.
  const refetchNewRef = useRef<() => void>(() => undefined);
  refetchNewRef.current = () => {
    refetchNew();
  };
  const countdownsRef = useRef<OfferCountdowns | null>(null);
  if (countdownsRef.current === null) {
    countdownsRef.current = new OfferCountdowns({
      // The deadline passed: look again, in case the socket message saying
      // the offer ended was missed. The phone never declines by itself.
      onDeadline: () => refetchNewRef.current(),
      // Expiry off: the offer is still waiting, alert the rider again (AC-4).
      onReminder: (orderId, waitedMs) => {
        remindRiderOfOffer(orderId, waitedMs);
        setReminderTick(tick => tick + 1);
      },
      // The offer left: take its reminder out of the notification tray.
      onRemindersEnded: orderId => cancelOfferReminder(orderId),
    });
  }
  const countdowns = countdownsRef.current;

  // Latest fetched offers, read when a failed send puts an offer back. Set
  // on every render, below, once the rider's status is known.
  const newOrdersRef = useRef<Order[] | undefined>(newOrders);

  // Show the fetched offers the rider can still answer. This skips offers
  // being accepted or declined, and offers already answered whose refetch has
  // not landed yet, when only this redraw runs (a failed send elsewhere
  // redraws from the older list). It cannot hide an answered offer from a
  // sync: if the effect below reruns from that older list before the
  // refetch lands (the rider's setting changed), it tracks the offer again.
  const showUnclaimedOffers = () => {
    setDataSourceNew(
      (newOrdersRef.current ?? []).filter(order => countdowns.isOpen(order.id)),
    );
  };

  // A send failed: let the rider try again by hand.
  const releaseOffer = (orderId: string) => {
    countdowns.release(orderId);
    showUnclaimedOffers();
  };

  // The server said the offer had already ended (409, AC-5): it expired, the
  // rider went Offline, or an admin moved it. Drop it, say so once, and do
  // not try again.
  const dropEndedOffer = (orderId: string) => {
    countdowns.forget(orderId);
    // Take it out of the cached list too, as the socket's OFFER_ENDED does, so
    // a redraw from the cache before the refetch lands cannot bring it back.
    queryClient.setQueryData<Order[]>([QueryKeys.newOrders], offers =>
      offers?.filter(offer => offer.id !== orderId),
    );
    setDataSourceNew(current => current.filter(order => order.id !== orderId));
    refetchNewRef.current();
    Alert.alert(i18next.t('translations:offer_has_ended'));
  };

  // mutations

  const { mutate: acceptOrder } = useMutation({
    mutationFn: services.orderService.acceptOrder,
    // The second argument is the offer id we passed to `acceptOrder(id)`.
    onSuccess: (_result, orderId) => {
      countdowns.forget(orderId);
      refetchNew();
      refetchInProgress();
    },
    onError: (error, orderId) => {
      if (isOfferEndedError(error)) {
        dropEndedOffer(orderId);
        return;
      }
      releaseOffer(orderId);
      Alert.alert('Error accepting order', error.message);
    },
  });

  const { mutate: declineOrder } = useMutation({
    mutationFn: services.orderService.declineOrder,
    onSuccess: (_result, orderId) => {
      countdowns.forget(orderId);
      refetchNew();
    },
    onError: (error, orderId) => {
      if (isOfferEndedError(error)) {
        dropEndedOffer(orderId);
        return;
      }
      releaseOffer(orderId);
      Alert.alert('Error declining order', error.message);
    },
  });

  //Temp fix
  const [upDownVotedNoteIds, setUpDownVotedNoteIds] = useState<string[][]>([
    [],
    [],
  ]);

  const { user } = useUser();

  // An Offline rider holds no offers: the server ends every offer the moment
  // the rider goes Offline (AC-6), and the live connection that would say so
  // closes at the same moment, so the phone does not wait to be told. This
  // hides them on the render that sees Offline; the effect below then empties
  // the cached list, so going Online again starts from nothing.
  const isOffline = user?.status === UserStatus.Offline;
  newOrdersRef.current = newOrders === undefined || !isOffline ? newOrders : [];

  // Going Offline empties the cached offers. Otherwise, back Online, the
  // offers from before (all ended by the server meanwhile) would be tracked
  // again before the fresh fetch lands: a manual rider would see dead offers
  // and an auto accept rider's phone would accept them. Online, the list is
  // only what the fetch made on going Online returns (the effect further
  // down).
  useEffect(() => {
    if (!isOffline) {
      return;
    }
    // A fetch still on its way could bring the old list back, so stop it
    // first. Stopping a fetch puts back the list from before it, which is
    // why the list is emptied only after that has finished (`.then`).
    queryClient
      .cancelQueries({ queryKey: [QueryKeys.newOrders] })
      .then(() => queryClient.setQueryData<Order[]>([QueryKeys.newOrders], []));
  }, [isOffline, queryClient]);

  // True when this phone already answered the offer from its alert (row 58,
  // AC-5): a tap in the app then sends nothing.
  const answeredFromAlert = (orderId: string) => {
    const order = newOrdersRef.current?.find(offer => offer.id === orderId);
    return isOfferAnswered(offerKeyOf(orderId, order?.offeredAt));
  };

  const acceptOrderFn = (orderId: string) => {
    // Only the first accept or decline for an offer is sent.
    if (answeredFromAlert(orderId) || !countdowns.claim(orderId)) {
      return;
    }
    // Answered here: its alert, if one is up, stops ringing (row 58).
    cancelOfferAlert(orderId);
    acceptOrder(orderId);
    setDataSourceNew(current => current.filter(order => order.id !== orderId));
  };

  const declineOrderFn = (orderId: string) => {
    if (answeredFromAlert(orderId) || !countdowns.claim(orderId)) {
      return;
    }
    cancelOfferAlert(orderId);
    declineOrder(orderId);
    setDataSourceNew(current => current.filter(order => order.id !== orderId));
  };

  const autoAccept = user?.deliverySetting === OrderSetting.auto_accept;

  useEffect(() => {
    const offers = newOrdersRef.current;
    if (offers !== undefined) {
      // Tracks offers seen for the first time (or offered again); stops the
      // timer of offers that are gone.
      countdowns.sync(offers.map(offerTimingOf));
      // Auto accept riders: the phone accepts each offer as soon as it
      // arrives (AC-8), at most once per offer. The server never accepts on
      // the rider's behalf.
      if (autoAccept) {
        for (const order of offers) {
          if (
            !answeredFromAlert(order.id) &&
            countdowns.claimForAutoAccept(order.id)
          ) {
            cancelOfferAlert(order.id);
            acceptOrder(order.id);
          }
        }
      }
      ringForNewOffers(offers);
      showUnclaimedOffers();
    }
    // `countdowns` is the same object for the screen's whole life and
    // `showUnclaimedOffers` reads refs, so only a new fetch, going Offline or
    // a change of the rider's setting should rerun this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newOrders, autoAccept, isOffline]);

  // The offers this screen has already rung for, by delivery id and offer
  // time, so each new offer rings once and a refetch never rings again.
  const rungForRef = useRef<Set<string>>(new Set());
  // AC-12: with the offers list in front, a new offer rings once here instead
  // of posting a system alert (the push handler posts none on this screen).
  // Auto accept riders are not rung for: the phone accepts the offer at once.
  const ringForNewOffers = (offers: Order[]) => {
    let anyNew = false;
    for (const order of offers) {
      const key = offerKeyOf(order.id, order.offeredAt);
      if (!rungForRef.current.has(key)) {
        rungForRef.current.add(key);
        anyNew = true;
      }
    }
    if (anyNew && !autoAccept && isHomeInFront()) {
      playOfferSound();
    }
  };

  // The list of offers the alert buttons answered lives in storage: read it
  // once, so a tap here can check it straight away.
  useEffect(() => {
    loadAnsweredOffers();
  }, []);

  // Stop every countdown when the screen goes away.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => countdowns.stopAll(), []);

  useEffect(() => {
    setDataSourceInProgress(inProgressOrders ?? []);
  }, [inProgressOrders]);

  useEffect(() => {
    if (historyOrders) {
      setDataSourceHistory(historyOrders);
    }
  }, [historyOrders]);

  useEffect(() => {
    if (user?.status === UserStatus.Online) {
      refetchNew();
    }
  }, [user?.status]);

  const upvoteCommentTemp = (noteId: string) => {
    if (!upDownVotedNoteIds[0].includes(noteId)) {
      setUpDownVotedNoteIds([
        [...upDownVotedNoteIds[0], noteId],
        upDownVotedNoteIds[1].filter(e => e != noteId),
      ]);
    }
  };

  const downvoteCommentTemp = (noteId: string) => {
    if (!upDownVotedNoteIds[1].includes(noteId)) {
      setUpDownVotedNoteIds([
        upDownVotedNoteIds[0].filter(e => e != noteId),
        [...upDownVotedNoteIds[1], noteId],
      ]);
    }
  };

  return {
    dataSourceNew,
    dataSourceHistory,
    dataSourceInProgress,
    // Milliseconds left before an offer's deadline, for the progress bar;
    // null when the offer has no deadline (no bar is shown).
    timeLeftForOffer: (orderId: string) => countdowns.timeLeft(orderId),
    // The offer's whole countdown length, for the bar; null with no deadline.
    totalTimeForOffer: (orderId: string) => countdowns.totalTime(orderId),
    // How long an offer has waited since it was made ("Waiting X min").
    waitedTimeForOffer: (orderId: string) => countdowns.waitedTime(orderId),
    acceptOrderFn,
    declineOrderFn,
    //Temp fix
    upDownVotedNoteIds,
    upvoteCommentTemp,
    downvoteCommentTemp,
    isLoading:
      loadingNewOrders || loadingInProgressOrders || loadingHistoryOrders,
    refetchNew,
    refetchInProgress,
    refechHistory,
  };
};
