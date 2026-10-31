import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { services } from '@app/services/service';
import {
  OutboxItem,
  flushOutbox,
  getOutboxItems,
  subscribeOutbox,
} from '@app/services/jobStepOutbox';
import { ConnectionStatus } from '@app/services/liveConnection';
import { hideInProgressOrderAfterDelivery } from '@app/utilities/inProgressListFilter';
import { QueryKeys } from '@app/utilities/queryKeys';

// How often the app tries again while steps wait for signal (spec 0009). A
// constant, not a co-op setting: it decides no pay and no assignment.
export const OUTBOX_RETRY_MS = 30 * 1000;

// Every outbox item, kept up to date. `useSyncExternalStore` is React's hook
// for reading a store that lives outside React: the component redraws
// whenever the store calls its listeners.
export const useOutboxItems = (): OutboxItem[] =>
  useSyncExternalStore(subscribeOutbox, getOutboxItems);

// Sends the rider's waiting job steps whenever there may be signal: after a
// tap, at login, when the live connection comes back, when the app comes to
// the front, and every 30 s while any wait (spec 0009, AC-3). Mounted once,
// in the socket provider.
export const useJobStepOutbox = (
  courierId: string | undefined,
  connection: ConnectionStatus,
): void => {
  const queryClient = useQueryClient();
  const items = useOutboxItems();
  const waiting =
    courierId !== undefined &&
    items.some(
      item => item.courierId === courierId && item.state === 'waiting',
    );

  const flush = useCallback(() => {
    if (!courierId) {
      return;
    }
    flushOutbox(
      courierId,
      services.orderService.sendJobStep,
      (item, outcome) => {
        if (outcome === 'sent' && item.step === 'delivered') {
          // Its row must not come back from a list fetched a moment too early.
          hideInProgressOrderAfterDelivery(item.deliveryId);
          [
            QueryKeys.orderHistory,
            QueryKeys.earningsSummary,
            QueryKeys.earningsDay,
            QueryKeys.earningsDelivery,
          ].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
        }
        // Sent or refused, the server has the last word on the list.
        queryClient.invalidateQueries({
          queryKey: [QueryKeys.inProgressOrders],
        });
      },
    ).catch(error => console.log('Job step outbox: send failed', error));
  }, [courierId, queryClient]);

  // A new tap, or a login with steps left from before.
  useEffect(() => {
    if (waiting) {
      flush();
    }
  }, [items, waiting, flush]);

  // The live connection is back: the server can be reached again.
  useEffect(() => {
    if (connection === 'connected') {
      flush();
    }
  }, [connection, flush]);

  // The app comes to the front.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        flush();
      }
    });
    return () => subscription.remove();
  }, [flush]);

  // Every 30 s while steps wait.
  useEffect(() => {
    if (!waiting) {
      return;
    }
    const timer = setInterval(flush, OUTBOX_RETRY_MS);
    return () => clearInterval(timer);
  }, [waiting, flush]);
};
