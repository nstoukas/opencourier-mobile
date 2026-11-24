import { parseJobReadyUpdate } from '@app/utilities/readySignals';
import { showReadyNotice } from '@app/services/readyNotice/readyNotice';
import { receiveRemovalDecision } from '@app/services/removalNotice/removalNotice';
import { receiveSplitDecision } from '@app/services/splitNotice/splitNotice';
import useUser from '@app/hooks/useUser';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { inProgressOrdersAsShown } from '@app/utilities/inProgressListFilter';
import { useJobStepOutbox, useOutboxItems } from '@app/hooks/useJobStepOutbox';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useSyncExternalStore,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { Order } from '@app/types/types';
import { cancelEndedOfferAlert } from './offerPush/offerAlert';
import { isTheEndedOffer } from '@app/utilities/endedOffer';
import { markOfferEnded } from './offerPush/answeredOffers';
import { isFromDispatch } from './chat/chatService';
import { noticeChatMessage } from './chat/chatNotice';
import {
  ConnectionStatus,
  createCourierSocket,
  LiveConnection,
  shouldBeConnected,
} from './liveConnection';
import { socketUrl } from '@app/utilities/config';
import { client } from '@app/services/Client';
import {
  endExpiredSession,
  getTokensSaved,
  subscribeTokensSaved,
} from '@app/services/session';
import { noticeForRefusal } from '@app/services/account/sessionEndNotice';

// A React context hands one value to every screen below the provider without
// passing it through each screen's props. Here the value is the connection status.
const ConnectionStatusContext = createContext<ConnectionStatus>('off');

// Any screen can call this to read the live connection status (the home dot).
export const useConnectionStatus = (): ConnectionStatus =>
  useContext(ConnectionStatusContext);

type Props = { children: ReactNode };

// Holds the app's one live connection (Socket.IO) to the instance. Offers and
// delivery status changes arrive here; this provider only asks the screens'
// queries to fetch again, so the server stays the one source of truth.
// Location is never sent over this connection (value 5).
const SocketProvider = ({ children }: Props) => {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [status, setStatus] = useState<ConnectionStatus>('off');

  // Jobs the rider still carries. Same query (and cache) as the home screen's
  // In Progress tab, so this adds no extra request while Home is open.
  const { data: inProgressData } = useQuery({
    queryFn: services.orderService.getInProgressOrders,
    queryKey: [QueryKeys.inProgressOrders],
    enabled: !!user,
  });
  // Same list as the In Progress tab: delivered or canceled jobs do not count,
  // unless a step of theirs still waits to be sent (spec 0009).
  const outboxItems = useOutboxItems();
  const inProgressOrders = inProgressOrdersAsShown(
    inProgressData,
    outboxItems,
    user?.id,
  );

  // Sends the steps the rider tapped with no signal (spec 0009).
  useJobStepOutbox(user?.id, status);

  const refetch = (keys: string[]) =>
    keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));

  // `useRef` keeps the same LiveConnection for the provider's whole life, so a
  // re-render never opens a second socket.
  const connectionRef = useRef<LiveConnection | null>(null);
  if (connectionRef.current === null) {
    connectionRef.current = new LiveConnection(createCourierSocket, {
      onStatus: setStatus,
      // Spec 0051: a connection refused because the account was deactivated or the login changed ends the
      // session with the same full screen notice as a refused renewal.
      onRefusedWithCode: (code, message) => {
        const notice = noticeForRefusal({
          response: { data: { result: [{ code, message }] } },
        });
        if (notice) {
          endExpiredSession(client, notice).catch(() => undefined);
        }
      },
      onOffer: () => refetch([QueryKeys.newOrders]),
      // The server ended an offer (spec 0002): take it off the screen at
      // once, then fetch the list again so the server has the last word.
      // Nothing is shown to the rider about it, and nothing is counted.
      onOfferEnded: (deliveryId, offeredAt) => {
        if (deliveryId !== null) {
          // Row 155: a push of this very offer arriving later will not ring.
          markOfferEnded(deliveryId, offeredAt).catch(error =>
            console.log('Could not keep the ended offer', error),
          );
          // Its alert stops ringing too, if one is up (row 58, AC-6).
          // Only the offer that ended (rows 154 and 155 review).
          cancelEndedOfferAlert(deliveryId, offeredAt);
          // `setQueryData` edits the cached offer list in place; the Home
          // screen redraws from it straight away.
          queryClient.setQueryData<Order[]>([QueryKeys.newOrders], offers =>
            offers?.filter(
              offer =>
                offer.id !== deliveryId ||
                !isTheEndedOffer(offer.offeredAt, offeredAt),
            ),
          );
        }
        refetch([QueryKeys.newOrders]);
      },
      // The rider too: the server may change their status with a delivery
      // (a Last Call rider is set Offline on accepting), and no other message
      // says so. Tracking and the "online" sign follow it (row 68, AC-9).
      // The jobs come first and the rider after: in the other order, an Offline
      // rider whose new job had not arrived yet would stop tracking for a
      // moment, and Android may refuse the restart in the background.
      onDeliveryStatusUpdated: () => {
        // cancelledJobs: a job of this rider's cancelled now shows its card at once (spec 0015).
        refetch([QueryKeys.newOrders, QueryKeys.cancelledJobs]);
        // Spec 0042: a cancel, reassignment or end by dispatch changes the rider's Earnings rows and the
        // job's detail; mark them stale so an open Earnings screen reads them again (AC-13).
        queryClient.invalidateQueries({ queryKey: [QueryKeys.earningsMonth] });
        queryClient.invalidateQueries({
          queryKey: [QueryKeys.earningsDelivery],
        });
        queryClient
          .invalidateQueries({ queryKey: [QueryKeys.inProgressOrders] })
          .then(() =>
            queryClient.invalidateQueries({ queryKey: [QueryKeys.user] }),
          );
      },
      // Spec 0023 (AC-6): the restaurant moved a held job's ready time or
      // marked the food ready. A notice from the message itself, then the
      // held jobs only (not the offers, history or the rider).
      onJobReadyUpdated: (message: unknown) => {
        const update = parseJobReadyUpdate(message);
        if (!update) {
          return;
        }
        showReadyNotice(update).catch(error =>
          console.log('Could not show the ready notice', error),
        );
        queryClient.invalidateQueries({
          queryKey: [QueryKeys.inProgressOrders],
        });
      },
      // Spec 0035 (AC-11): dispatch answered a removal request.
      onRemovalRequestDecided: (message: unknown) => {
        receiveRemovalDecision(message, queryClient).catch(error =>
          console.log('Could not show the removal notice', error),
        );
      },
      // Spec 0047: dispatch answered a split request. The job list carries the answer
      // (and, on a confirm, the leg and its size); the rider is also told, with a sound,
      // as a removal answer is (cross check 12, row 11 review).
      onSplitRequestDecided: (message: unknown) => {
        receiveSplitDecision(message, queryClient).catch(error =>
          console.log('Could not show the split notice', error),
        );
      },
      // Chat (spec 0034, AC-8): the messages live in the server's database, so
      // a message or a read mark is just a reason to fetch the thread again.
      onChatMessage: (message: unknown) => {
        refetch([QueryKeys.chatMessages]);
        // The thread's every message comes here, the rider's own too: only dispatch's draws the
        // notice (review of 2026-11-18, AC-11).
        if (isFromDispatch(message)) {
          noticeChatMessage().catch(error =>
            console.log('Could not show the chat notice', error),
          );
        }
      },
      onChatReadByDispatch: () => refetch([QueryKeys.chatMessages]),
      // After any (re)connect, fetch what may have been sent while away.
      onConnected: () =>
        refetch([
          QueryKeys.newOrders,
          QueryKeys.inProgressOrders,
          QueryKeys.chatMessages,
        ]),
    });
  }
  const connection = connectionRef.current;

  const wanted = shouldBeConnected(user?.status, inProgressOrders?.length ?? 0);
  // `useSyncExternalStore` reads a store outside React and redraws when it changes.
  const tokensSaved = useSyncExternalStore(
    subscribeTokensSaved,
    getTokensSaved,
  );

  useEffect(() => {
    if (!wanted) {
      // Logged out, or Offline with no job: close the socket.
      connection.close();
      return;
    }
    // The token is read fresh each time, so a new login (another rider, another
    // token) opens a new socket. The address is the co-op's, fixed by the build
    // (row 17, spec 0039, AC-1).
    let cancelled = false;
    (async () => {
      const token = await AsyncStorage.getItem('token');
      if (!cancelled && token && socketUrl) {
        connection.open(socketUrl, token);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Spec 0051 (row 108 review): `tokensSaved` changes when new tokens are saved (a password change), so
    // the socket reopens with them.
  }, [wanted, user?.id, connection, tokensSaved]);

  // When the app comes back to the foreground, reconnect if the socket is down.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        connection.resume();
        // Learn any status change made while the app was away (an admin, or
        // the server), so tracking and the "online" sign follow it (AC-9).
        queryClient.invalidateQueries({ queryKey: [QueryKeys.user] });
        // An Offline rider has no socket and gets no push: a message dispatch wrote while the app
        // was away shows its dot now (spec 0034, AC-10).
        queryClient.invalidateQueries({ queryKey: [QueryKeys.chatMessages] });
      }
    });
    return () => subscription.remove();
  }, [connection, queryClient]);

  // Close the socket if the provider itself goes away.
  useEffect(() => () => connection.close(), [connection]);

  return (
    <ConnectionStatusContext.Provider value={status}>
      {children}
    </ConnectionStatusContext.Provider>
  );
};

export default SocketProvider;
