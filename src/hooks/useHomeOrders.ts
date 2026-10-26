import { Order, UserStatus } from '@app/types/types';
import { services } from '@app/services/service';
import { useEffect, useRef, useState } from 'react';
import { OrderSetting } from '@app/types/enums';
import { filterInProgressOrdersForDisplay } from '@app/utilities/inProgressListFilter';
import { Alert } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { QueryKeys } from '@app/utilities/queryKeys';
import useUser from './useUser';
import { OfferCountdowns, OfferTiming } from '@app/utilities/offerCountdowns';
import { isOfferEndedError } from '@app/services/orderService';
import {
  cancelOfferReminder,
  remindRiderOfOffer,
} from '@app/services/offerReminder';
import i18next from 'i18next';

// An offer's timing as the countdowns need it (spec 0002).
const offerTimingOf = (order: Order): OfferTiming => ({
  id: order.id,
  offerKey: order.offeredAt ?? null,
  offeredAt: order.phoneClock?.offeredAt ?? null,
  expiresAt: order.phoneClock?.expiresAt ?? null,
});

export const useHomeOrders = () => {
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
  // not landed yet (a failed send elsewhere can redraw from the older list).
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
  // closes at the same moment, so the phone does not wait to be told.
  const isOffline = user?.status === UserStatus.Offline;
  newOrdersRef.current = newOrders === undefined || !isOffline ? newOrders : [];

  const acceptOrderFn = (orderId: string) => {
    // Only the first accept or decline for an offer is sent.
    if (!countdowns.claim(orderId)) {
      return;
    }
    acceptOrder(orderId);
    setDataSourceNew(current => current.filter(order => order.id !== orderId));
  };

  const declineOrderFn = (orderId: string) => {
    if (!countdowns.claim(orderId)) {
      return;
    }
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
          if (countdowns.claimForAutoAccept(order.id)) {
            acceptOrder(order.id);
          }
        }
      }
      showUnclaimedOffers();
    }
    // `countdowns` is the same object for the screen's whole life and
    // `showUnclaimedOffers` reads refs, so only a new fetch, going Offline or
    // a change of the rider's setting should rerun this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newOrders, autoAccept, isOffline]);

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
