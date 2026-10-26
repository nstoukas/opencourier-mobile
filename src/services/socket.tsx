import useUser from '@app/hooks/useUser';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { filterInProgressOrdersForDisplay } from '@app/utilities/inProgressListFilter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { Order } from '@app/types/types';
import { cancelOfferAlert } from './offerPush/offerAlert';
import {
  ConnectionStatus,
  createCourierSocket,
  LiveConnection,
  shouldBeConnected,
} from './liveConnection';

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
  const { data: inProgressOrders } = useQuery({
    queryFn: services.orderService.getInProgressOrders,
    queryKey: [QueryKeys.inProgressOrders],
    enabled: !!user,
    // Same filter as the In Progress tab: delivered or canceled jobs do not count.
    select: data => filterInProgressOrdersForDisplay(data),
  });

  const refetch = (keys: string[]) =>
    keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));

  // `useRef` keeps the same LiveConnection for the provider's whole life, so a
  // re-render never opens a second socket.
  const connectionRef = useRef<LiveConnection | null>(null);
  if (connectionRef.current === null) {
    connectionRef.current = new LiveConnection(createCourierSocket, {
      onStatus: setStatus,
      onOffer: () => refetch([QueryKeys.newOrders]),
      // The server ended an offer (spec 0002): take it off the screen at
      // once, then fetch the list again so the server has the last word.
      // Nothing is shown to the rider about it, and nothing is counted.
      onOfferEnded: deliveryId => {
        if (deliveryId !== null) {
          // Its alert stops ringing too, if one is up (row 58, AC-6).
          cancelOfferAlert(deliveryId);
          // `setQueryData` edits the cached offer list in place; the Home
          // screen redraws from it straight away.
          queryClient.setQueryData<Order[]>([QueryKeys.newOrders], offers =>
            offers?.filter(offer => offer.id !== deliveryId),
          );
        }
        refetch([QueryKeys.newOrders]);
      },
      onDeliveryStatusUpdated: () =>
        refetch([
          QueryKeys.newOrders,
          QueryKeys.inProgressOrders,
          QueryKeys.orderHistory,
        ]),
      // After any (re)connect, fetch what may have been sent while away.
      onConnected: () =>
        refetch([QueryKeys.newOrders, QueryKeys.inProgressOrders]),
    });
  }
  const connection = connectionRef.current;

  const wanted = shouldBeConnected(user?.status, inProgressOrders?.length ?? 0);

  useEffect(() => {
    if (!wanted) {
      // Logged out, or Offline with no job: close the socket.
      connection.close();
      return;
    }
    // The token and socket address are read fresh each time, so a new login
    // (another rider, another token) opens a new socket.
    let cancelled = false;
    (async () => {
      const [token, url] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('SOCKET_BASE_URL'),
      ]);
      if (!cancelled && token && url) {
        connection.open(url, token);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wanted, user?.id, connection]);

  // When the app comes back to the foreground, reconnect if the socket is down.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        connection.resume();
      }
    });
    return () => subscription.remove();
  }, [connection]);

  // Close the socket if the provider itself goes away.
  useEffect(() => () => connection.close(), [connection]);

  return (
    <ConnectionStatusContext.Provider value={status}>
      {children}
    </ConnectionStatusContext.Provider>
  );
};

export default SocketProvider;
