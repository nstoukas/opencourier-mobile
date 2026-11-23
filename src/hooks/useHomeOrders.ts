import { Order, UserStatus } from '@app/types/types';
import { services } from '@app/services/service';
import { useEffect, useRef, useState } from 'react';
import { OrderSetting } from '@app/types/enums';
import { inProgressOrdersAsShown } from '@app/utilities/inProgressListFilter';
import { useOutboxItems } from './useJobStepOutbox';
import { Alert } from 'react-native';
import { serverMessage } from './useMoveDropoffPin';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from '@app/utilities/queryKeys';
import useUser from './useUser';
import { OfferCountdowns, OfferTiming } from '@app/utilities/offerCountdowns';
import {
  isOfferEndedError,
  serverSentenceOf,
} from '@app/services/orderService';
import {
  cancelOfferReminder,
  remindRiderOfOffer,
} from '@app/services/offerReminder';
import i18next from 'i18next';
import { isCalmAddOn, stackStopsOf } from '@app/utilities/stack';
import {
  isOfferAnswered,
  loadAnsweredOffers,
  markOfferAnswered,
  offerKeyOf,
  unmarkOfferAnswered,
} from '@app/services/offerPush/answeredOffers';
import {
  cancelOfferAlert,
  isOfferAlertDisplayed,
} from '@app/services/offerPush/offerAlert';
import { playOfferSound } from '@app/services/offerPush/phone';
import { announceAutoAccept } from '@app/services/offerPush/autoAccepted';
import { useSosRecord } from '@app/hooks/useSos';
import { isSharing } from '@app/services/sosStore';
import { isHomeInFront } from '@app/navigation/navigationRef';

// What one accept carries (spec 0020, AC-11). `automatic` is true only when
// the phone accepted by itself; `restaurantName` names the order in the auto
// accept notice (AC-12). Only `id` and `automatic` are sent to the server.
type AcceptVariables = {
  id: string;
  automatic: boolean;
  restaurantName?: string;
  // Spec 0048: the other order of a stack, accepted by the same call.
  partnerId?: string;
};

// The restaurant's name as the rest of the app shows it.
const restaurantNameOf = (order: Order): string =>
  order.pickupBusinessName || order.pickupName || '';

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
  // Decision 128.6: orders of a pair the phone tried to take by itself and
  // could not (the accept failed, or only one order could be claimed), or
  // chose not to (see autoAcceptStack). Row 130: a single order whose
  // automatic accept failed, too. The phone tries once only, so Home shows
  // these as a card even to a rider on auto accept, to answer by hand.
  const [handAnswerIds, setHandAnswerIds] = useState<string[]>([]);
  const leaveToRider = (ids: string[]) =>
    setHandAnswerIds(current => [
      ...current,
      ...ids.filter(id => !current.includes(id)),
    ]);

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
  });

  // The history has its own screen and query since spec 0018 (History.tsx);
  // home no longer asks for it.

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
      // Not while the offer's push alert is up: it is ringing already, and a
      // second notification for one offer only adds noise (row 58, 58.26).
      onReminder: (orderId, waitedMs) => {
        // Row 81 (cross check 2): an add on offered while the rider carries
        // food never rings again; it waits quietly on its card.
        const offer = newOrdersRef.current?.find(o => o.id === orderId);
        if (offer && isCalmAddOn(offer, inProgressRef.current)) {
          return;
        }
        isOfferAlertDisplayed(orderId).then(alertIsUp => {
          if (!alertIsUp) {
            remindRiderOfOffer(orderId, waitedMs);
          }
        });
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
  // Row 81: the rider's jobs as the server last sent them, read by the
  // reminder timer (set long ago) to tell a calm add on.
  const inProgressRef = useRef<Order[]>([]);
  inProgressRef.current = inProgressOrders ?? [];

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

  // A send failed: let the rider try again by hand, from the app or the alert.
  const releaseOffer = (orderId: string) => {
    countdowns.release(orderId);
    unmarkOfferAnswered(answeredKeyOf(orderId));
    showUnclaimedOffers();
  };

  // The server said the offer had already ended (409, AC-5): it expired, the
  // rider went Offline, or an admin moved it. Drop it, say so once, and do
  // not try again.
  // `partnerId`: the other order of a stack, which ended with it.
  const dropEndedOffer = (orderId: string, partnerId?: string) => {
    const ids = partnerId ? [orderId, partnerId] : [orderId];
    ids.forEach(id => countdowns.forget(id));
    // Take it out of the cached list too, as the socket's OFFER_ENDED does, so
    // a redraw from the cache before the refetch lands cannot bring it back.
    queryClient.setQueryData<Order[]>([QueryKeys.newOrders], offers =>
      offers?.filter(offer => !ids.includes(offer.id)),
    );
    setDataSourceNew(current =>
      current.filter(order => !ids.includes(order.id)),
    );
    refetchNewRef.current();
    Alert.alert(i18next.t('translations:offer_has_ended'));
  };

  // Spec 0048 (AC-5): a stack's answer was refused because one of its two
  // orders changed first. Nothing was
  // accepted or declined: both come back to the rider, the server's own
  // sentence says what happened, and the list is fetched again.
  const refusedStackAnswer = (
    orderId: string,
    partnerId: string,
    error: Error,
    title: string,
  ) => {
    releaseOffer(orderId);
    releaseOffer(partnerId);
    refetchNewRef.current();
    const sentence = serverSentenceOf(error);
    // With no refusal from the server, a plain sentence, never axios's own English ("Network Error").
    Alert.alert(
      sentence ?? title,
      sentence ? undefined : i18next.t('translations:auth_error_other'),
    );
  };

  // Spec 0048: the other offer of the same stack in the fetched list, if any.
  const stackPartnerIdOf = (orderId: string): string | undefined => {
    const offers = newOrdersRef.current ?? [];
    const groupId = offers.find(offer => offer.id === orderId)?.offerGroupId;
    return groupId
      ? offers.find(
          offer => offer.id !== orderId && offer.offerGroupId === groupId,
        )?.id
      : undefined;
  };

  // mutations

  const { mutate: acceptOrder } = useMutation({
    mutationFn: ({ id, automatic, partnerId }: AcceptVariables) =>
      services.orderService.acceptOrder({ id, automatic, partnerId }),
    // The second argument is what we passed to `acceptOrder({ ... })`; the
    // `{ id: orderId }` pattern takes its `id` out under the name `orderId`.
    onSuccess: async (
      _result,
      { id: orderId, automatic, restaurantName, partnerId },
    ) => {
      countdowns.forget(orderId);
      if (partnerId) {
        countdowns.forget(partnerId);
      }
      // The phone took this order by itself: say so, with its own sound, once
      // (spec 0020, AC-12). A tapped accept plays nothing new.
      // A pair (decision 128.0) says it is two orders; with no restaurant
      // name it names none (decision 128.6), never "a new order".
      if (automatic) {
        announceAutoAccept(
          orderId,
          partnerId
            ? restaurantName ?? ''
            : restaurantName || i18next.t('translations:auto_accepted_no_name'),
          !!partnerId,
        );
      }
      refetchNew();
      // The jobs first, then the user, in that order (as socket.tsx does, for
      // row 68's tracking reason): a rider on Last call is set Offline by the
      // server at this accept, and home shows the job and Offline together
      // even when the live connection is down (spec 0018, AC-10).
      await queryClient.invalidateQueries({
        queryKey: [QueryKeys.inProgressOrders],
      });
      await queryClient.invalidateQueries({ queryKey: [QueryKeys.user] });
    },
    onError: (error, { id: orderId, automatic, partnerId }) => {
      if (isOfferEndedError(error)) {
        dropEndedOffer(orderId, partnerId);
        return;
      }
      if (partnerId) {
        // Decision 128.6: an automatic pair that failed (no network, the
        // pair changed, a dispatch stop) goes to the rider as a card. If the
        // server split the pair, the order left on offer keeps its id, so it
        // shows too, as a single order.
        if (automatic) {
          leaveToRider([orderId, partnerId]);
        }
        refusedStackAnswer(
          orderId,
          partnerId,
          error,
          i18next.t('translations:accept_failed_title'),
        );
        return;
      }
      // Row 130: a single order the phone could not take by itself goes to
      // the rider as a card too, as a pair does (decision 128.6). The phone
      // tried once and will not try again, so without this the offer would
      // stay hidden from a rider on auto accept until it ended.
      if (automatic) {
        leaveToRider([orderId]);
      }
      releaseOffer(orderId);
      // Decision 130.3: the phone's own accept can fail after the server
      // took it (a 10 s timeout), or because the offer changed. Fetch both
      // lists again, so the rider sees the job, or the offer as it is now,
      // rather than an old card. Not retried: the phone still tries once.
      if (automatic) {
        refetchNewRef.current();
        queryClient.invalidateQueries({
          queryKey: [QueryKeys.inProgressOrders],
        });
      }
      // In the rider's language (spec 0054): the refusal's words when the server sent one.
      Alert.alert(
        i18next.t('translations:accept_failed_title'),
        serverMessage(error) ?? i18next.t('translations:auth_error_other'),
      );
    },
  });

  // `partnerId` (spec 0048): the other order of a stack; the one decline
  // ends both on the server.
  const { mutate: declineOrder } = useMutation({
    mutationFn: ({ id }: { id: string; partnerId?: string }) =>
      services.orderService.declineOrder(id),
    onSuccess: (_result, { id: orderId, partnerId }) => {
      countdowns.forget(orderId);
      if (partnerId) {
        countdowns.forget(partnerId);
      }
      refetchNew();
    },
    onError: (error, { id: orderId, partnerId }) => {
      if (isOfferEndedError(error)) {
        dropEndedOffer(orderId, partnerId);
        return;
      }
      if (partnerId) {
        refusedStackAnswer(
          orderId,
          partnerId,
          error,
          i18next.t('translations:decline_failed_title'),
        );
        return;
      }
      releaseOffer(orderId);
      Alert.alert(
        i18next.t('translations:decline_failed_title'),
        serverMessage(error) ?? i18next.t('translations:auth_error_other'),
      );
    },
  });

  //Temp fix
  const [upDownVotedNoteIds, setUpDownVotedNoteIds] = useState<string[][]>([
    [],
    [],
  ]);

  const { user } = useUser();
  // While the rider's SOS is shared they take no job (decision 73.10): the
  // server refuses the accept, so the phone does not send one. Auto accept
  // skips the offer and it expires as usual (spec 0022, AC-7). A ref, so the
  // offers effect below reads the latest value without rerunning on it.
  const sosSharing = isSharing(useSosRecord(user?.id));
  const sosSharingRef = useRef(sosSharing);
  sosSharingRef.current = sosSharing;
  // The job steps tapped but not yet sent (spec 0009).
  const outboxItems = useOutboxItems();

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

  // The offer's entry in this phone's answered list (row 58, AC-5), shared
  // with the alert's Accept and Decline buttons.
  const answeredKeyOf = (orderId: string) => {
    const order = newOrdersRef.current?.find(offer => offer.id === orderId);
    return offerKeyOf(orderId, order?.offeredAt);
  };

  // True when this phone already answered the offer from its alert: a tap in
  // the app then sends nothing.
  const answeredFromAlert = (orderId: string) =>
    isOfferAnswered(answeredKeyOf(orderId));

  // Answered here: the alert's buttons, and a late re send of the offer, must
  // not answer or ring again (a failed send takes it back, in releaseOffer).
  const answerHere = (orderId: string) => {
    markOfferAnswered(answeredKeyOf(orderId));
    // Its alert, if one is up, stops ringing.
    cancelOfferAlert(orderId);
  };

  // Spec 0048: claims an offer, and the other offer of its stack if it has
  // one, so a second tap on either sends nothing. If the partner cannot be
  // claimed, the first is let go again and nothing is sent.
  const claimOffer = (orderId: string, partnerId: string | undefined) => {
    if (answeredFromAlert(orderId) || !countdowns.claim(orderId)) {
      return false;
    }
    if (partnerId && !countdowns.claim(partnerId)) {
      countdowns.release(orderId);
      return false;
    }
    return true;
  };

  const acceptOrderFn = (orderId: string) => {
    if (sosSharingRef.current) {
      Alert.alert(i18next.t('translations:sos_no_accept'));
      return;
    }
    // A stack is accepted as a pair, by one call (spec 0048, AC-5).
    const partnerId = stackPartnerIdOf(orderId);
    // Review of row 80: one order of a pair is answered only once the phone
    // has both orders and their stops, since the server takes both on this
    // one tap and the rider must see both first (AC-8). Half a pair, or a
    // pair without a usable stop list, waits for a fetch, which also catches
    // a pair the server has since split into a single offer.
    const offers = newOrdersRef.current ?? [];
    const offer = offers.find(candidate => candidate.id === orderId);
    if (offer?.offerGroupId) {
      const partner = offers.find(candidate => candidate.id === partnerId);
      if (!partner || !stackStopsOf(offer, partner)) {
        refetchNewRef.current();
        Alert.alert(i18next.t('translations:stack_still_loading'));
        return;
      }
    }
    // Only the first accept or decline for an offer is sent.
    if (!claimOffer(orderId, partnerId)) {
      return;
    }
    answerHere(orderId);
    if (partnerId) {
      answerHere(partnerId);
    }
    // The rider's own tap: never `automatic` (spec 0020, AC-11).
    acceptOrder({ id: orderId, automatic: false, partnerId });
    setDataSourceNew(current =>
      current.filter(order => order.id !== orderId && order.id !== partnerId),
    );
  };

  const declineOrderFn = (orderId: string) => {
    const partnerId = stackPartnerIdOf(orderId);
    if (!claimOffer(orderId, partnerId)) {
      return;
    }
    answerHere(orderId);
    if (partnerId) {
      answerHere(partnerId);
    }
    declineOrder({ id: orderId, partnerId });
    setDataSourceNew(current =>
      current.filter(order => order.id !== orderId && order.id !== partnerId),
    );
  };

  const autoAccept = user?.deliverySetting === OrderSetting.auto_accept;

  // Half pairs this screen has already fetched again for, by delivery id and
  // offer time, so each asks once and a refetch that still brings half a pair
  // does not loop (decision 128.6).
  const askedForPartnerRef = useRef<Set<string>>(new Set());

  // Decision 128.0: the phone takes a stack for an auto accept rider, once,
  // when it has both orders (the server takes both on the one call, and the
  // phone marks both dispatched). The second order of the pair finds itself
  // claimed and sends nothing. The phone does not try again by itself, as for
  // a single order: a pair it could not take goes to the rider as a card
  // (leaveToRider, decision 128.6). `mayTake` is false when the rider already
  // holds a job or the phone took another offer in this pass: the server's
  // offer limit should make that impossible, but the phone never asks for a
  // third order (decision 128.6). Returns true when an accept was sent.
  const autoAcceptStack = (
    order: Order,
    offers: Order[],
    mayTake: boolean,
  ): boolean => {
    const partner = offers.find(
      other =>
        other.id !== order.id && other.offerGroupId === order.offerGroupId,
    );
    if (!partner) {
      // Half a pair: ask for the other order now, once, rather than wait for
      // the next message or deadline check (decision 128.6).
      const key = offerKeyOf(order.id, order.offeredAt);
      if (!askedForPartnerRef.current.has(key)) {
        askedForPartnerRef.current.add(key);
        refetchNewRef.current();
      }
      return false;
    }
    if (
      answeredFromAlert(order.id) ||
      answeredFromAlert(partner.id) ||
      !countdowns.isOpen(order.id) ||
      !countdowns.isOpen(partner.id)
    ) {
      return false;
    }
    if (!mayTake) {
      leaveToRider([order.id, partner.id]);
      return false;
    }
    if (!countdowns.claimForAutoAccept(order.id)) {
      leaveToRider([order.id, partner.id]);
      return false;
    }
    if (!countdowns.claimForAutoAccept(partner.id)) {
      // Only one of the two could be claimed: neither is sent, both go to
      // the rider.
      countdowns.release(order.id);
      leaveToRider([order.id, partner.id]);
      return false;
    }
    answerHere(order.id);
    answerHere(partner.id);
    // Both restaurants in the notice, once each (two orders from one
    // restaurant name it once).
    const names = [restaurantNameOf(order), restaurantNameOf(partner)].filter(
      (name, index, all) => name !== '' && all.indexOf(name) === index,
    );
    acceptOrder({
      id: order.id,
      automatic: true,
      restaurantName: names.join(' · '),
      partnerId: partner.id,
    });
    return true;
  };

  useEffect(() => {
    const offers = newOrdersRef.current;
    if (offers !== undefined) {
      // Tracks offers seen for the first time (or offered again); stops the
      // timer of offers that are gone.
      countdowns.sync(offers.map(offerTimingOf));
      // Auto accept riders: the phone accepts each offer as soon as it
      // arrives (AC-8), at most once per offer, and tells the server it did
      // so by itself (spec 0020, AC-11). The server never accepts on the
      // rider's behalf.
      if (autoAccept && !sosSharingRef.current) {
        // Decision 128.6: whether the phone sent an accept in this pass, and
        // whether that accept was a pair (which fills the limit of two).
        let sentThisPass = false;
        let pairSent = false;
        const holdsJob = (inProgressOrders?.length ?? 0) > 0;
        for (const order of offers) {
          // Row 81 (spec 0048, AC-8): an add on is never accepted by the
          // phone: the rider must see what it adds to the job they are on. It
          // stays an offer on home, even for a rider on auto accept.
          if (order.addOn) {
            continue;
          }
          // Decision 128.0 (AC-8 as amended): a stack is taken like a single
          // order, by one call naming both. The server checked the box and
          // the limit of two when it offered the pair.
          if (order.offerGroupId) {
            if (autoAcceptStack(order, offers, !sentThisPass && !holdsJob)) {
              sentThisPass = true;
              pairSent = true;
            }
            continue;
          }
          // A pair already sent in this pass fills the limit of two.
          if (pairSent) {
            continue;
          }
          if (
            !answeredFromAlert(order.id) &&
            countdowns.claimForAutoAccept(order.id)
          ) {
            answerHere(order.id);
            acceptOrder({
              id: order.id,
              automatic: true,
              restaurantName: restaurantNameOf(order),
            });
            sentThisPass = true;
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
        // Row 81: an add on rings even for a rider on auto accept, who must
        // answer it by hand. One sound, never repeated: that is also all a
        // calm add on gets (cross check 2). A stack is taken by the phone
        // like a single order since decision 128.0, so it does not ring.
        if (!autoAccept || order.addOn) {
          anyNew = true;
        }
      }
    }
    if (anyNew) {
      isHomeInFront().then(inFront => {
        if (inFront) {
          playOfferSound();
        }
      });
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
    // Each order as the screen shows it: moved on by the steps still waiting
    // in the outbox, and kept while one does (spec 0009, AC-2).
    setDataSourceInProgress(
      inProgressOrdersAsShown(inProgressOrders, outboxItems, user?.id),
    );
  }, [inProgressOrders, outboxItems, user?.id]);

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
    dataSourceInProgress,
    // Offers Home shows to a rider on auto accept, to answer by hand
    // (decision 128.6).
    handAnswerIds,
    // The jobs as the SERVER has them, without the outbox's waiting steps:
    // the route is asked for the server's status (spec 0018, AC-6).
    serverInProgress: inProgressOrders ?? [],
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
    isLoading: loadingNewOrders || loadingInProgressOrders,
    refetchNew,
    refetchInProgress,
  };
};
