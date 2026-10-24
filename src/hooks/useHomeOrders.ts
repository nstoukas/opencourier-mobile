import { Order, UserStatus } from '@app/types/types';
import { services } from '@app/services/service';
import { useEffect, useRef, useState } from 'react';
import { AUTO_ACCEPT_DECLINE_TIMER } from '@app/utilities/constants';
import { OrderSetting } from '@app/types/enums';
import { filterInProgressOrdersForDisplay } from '@app/utilities/inProgressListFilter';
import { Alert } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { QueryKeys } from '@app/utilities/queryKeys';
import useUser from './useUser';
import { OfferCountdowns } from '@app/utilities/offerCountdowns';

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

  // One countdown per offer (row 60). `useRef` keeps the same object for the
  // whole life of the screen, so a re-render or a refetch never makes a new one.
  const countdownsRef = useRef<OfferCountdowns | null>(null);
  // The timer calls whatever function is in this ref when it fires, so it
  // always sees the latest user setting, not the one from when it started.
  const onExpireRef = useRef<(orderId: string) => void>(() => undefined);
  if (countdownsRef.current === null) {
    countdownsRef.current = new OfferCountdowns(
      AUTO_ACCEPT_DECLINE_TIMER,
      orderId => onExpireRef.current(orderId),
    );
  }
  const countdowns = countdownsRef.current;

  // Latest fetched offers, read when a failed send puts an offer back.
  const newOrdersRef = useRef<Order[] | undefined>(newOrders);
  newOrdersRef.current = newOrders;

  // Show every fetched offer except those already being accepted or declined.
  const showUnclaimedOffers = () => {
    setDataSourceNew(
      (newOrdersRef.current ?? []).filter(
        order => !countdowns.isClaimed(order.id),
      ),
    );
  };

  // A send failed: let the rider try again by hand.
  const releaseOffer = (orderId: string) => {
    countdowns.release(orderId);
    showUnclaimedOffers();
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

  onExpireRef.current = (orderId: string) =>
    user?.deliverySetting === OrderSetting.auto_accept
      ? acceptOrderFn(orderId)
      : declineOrderFn(orderId);

  useEffect(() => {
    if (newOrders !== undefined) {
      // Starts a countdown only for offers seen for the first time; stops the
      // countdown of offers that are gone.
      countdowns.sync(newOrders.map(order => order.id));
      showUnclaimedOffers();
    }
    // `countdowns` is the same object for the screen's whole life and
    // `showUnclaimedOffers` reads refs, so only a new fetch should rerun this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newOrders]);

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
    // Milliseconds left on an offer's countdown, for the progress bar.
    timeLeftForOffer: (orderId: string) => countdowns.timeLeft(orderId),
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
