import { useCallback } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import {
  Mutation,
  QueryClient,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { services } from '@app/services/service';
import { forgetRemovalDecision } from '@app/services/removalNotice/removalNotice';
import { Order, RemovalRequest } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import { serverMessage } from './useMoveDropoffPin';

// Spec 0035: a rider's removal request. A send starts on the Request removal screen and a withdraw on
// Home, and the rider can leave the screen mid send, so "is one on its way" has to be known in both
// places. React Query keeps a running mutation (a write to the server) outside any screen, so both can
// ask it. Online only, like the hand back: a tap with no signal says so and sends nothing later.
const REMOVAL_MUTATION_KEY = 'removalRequest';

// A filter for the mutations of one delivery. `mutation.state.variables` is what the send was given.
const removalFilters = (deliveryId: string | undefined) => ({
  mutationKey: [REMOVAL_MUTATION_KEY],
  predicate: (mutation: Mutation<any, any, any>) =>
    mutation.state.variables?.orderId === deliveryId,
});

// True while a send or withdraw for this delivery is on its way.
export const useRemovalBusy = (deliveryId: string | undefined): boolean =>
  useIsMutating(removalFilters(deliveryId)) > 0;

// A second tap in the same instant: the mutation is registered as soon as it starts, before any redraw.
const busyNow = (client: QueryClient, deliveryId: string): boolean =>
  client.isMutating(removalFilters(deliveryId)) > 0;

// The reasons, fresh each time the screen opens (a representative can edit them at any time).
// `gcTime: 0` forgets the list as soon as the screen closes, so a Paid mark never comes from an old copy.
export const useRemovalReasons = () =>
  useQuery({
    queryKey: [QueryKeys.removalReasons],
    queryFn: services.orderService.getRemovalReasons,
    gcTime: 0,
  });

// What the job shows now, ahead of the refetch.
const setRequestOnJob = (
  client: QueryClient,
  deliveryId: string,
  removalRequest: RemovalRequest | null,
) => {
  client.setQueryData<Order[]>([QueryKeys.inProgressOrders], jobs =>
    jobs?.map(job =>
      job.id === deliveryId ? { ...job, removalRequest } : job,
    ),
  );
};

type SendParams = { orderId: string; reasonId: string; note?: string };

export const useSendRemovalRequest = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationKey: [REMOVAL_MUTATION_KEY],
    // 'always' runs it even when React Query thinks there is no network, so a failure is told at once.
    networkMode: 'always',
    mutationFn: ({ orderId, reasonId, note }: SendParams) =>
      services.orderService.sendRemovalRequest({ id: orderId, reasonId, note }),
    // These run even if the rider has left the screen.
    onSuccess: (request, { orderId }) => {
      setRequestOnJob(queryClient, orderId, request);
    },
    onError: error => {
      // The message only: the whole error would print the rider's token.
      console.log(
        'Could not send the removal request',
        (error as Error)?.message,
      );
      const answered = axios.isAxiosError(error) && !!error.response;
      const notYours =
        axios.isAxiosError(error) && error.response?.status === 404;
      const reason = notYours
        ? t('translations:hand_back_not_yours')
        : serverMessage(error);
      Alert.alert(
        t('translations:removal_send_failed_title'),
        !answered
          ? t('translations:removal_send_no_connection')
          : reason
          ? t('translations:removal_send_refused', { reason })
          : t('translations:removal_send_failed'),
      );
    },
    // Either way the server has the last word: a send whose answer got lost shows up here.
    // Braces, so nothing is returned: React Query would keep the send "on its way" until the refetch ends.
    // A lost answer can still be a request that arrived, so the next decision counts as new here too.
    onSettled: (_request, _error, { orderId }) => {
      forgetRemovalDecision(orderId);
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.inProgressOrders],
      });
    },
  });

  // `onSent` runs only if the screen is still open, so leaving mid send never goes back twice.
  const send = useCallback(
    (params: SendParams, onSent: () => void) => {
      if (busyNow(queryClient, params.orderId)) {
        return;
      }
      mutate(params, { onSuccess: onSent });
    },
    [mutate, queryClient],
  );

  return { send };
};

export const useWithdrawRemoval = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationKey: [REMOVAL_MUTATION_KEY],
    networkMode: 'always',
    mutationFn: ({ orderId }: { orderId: string }) =>
      services.orderService.withdrawRemovalRequest(orderId),
    onSuccess: (_answer, { orderId }) =>
      setRequestOnJob(queryClient, orderId, null),
    onError: error => {
      console.log(
        'Could not withdraw the removal request',
        (error as Error)?.message,
      );
      Alert.alert(
        t('translations:removal_withdraw_failed_title'),
        serverMessage(error) ?? t('translations:removal_withdraw_failed'),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.inProgressOrders],
      });
    },
  });

  // Asks first, as the hand back does: a mis-tap should not cost the rider their place.
  return useCallback(
    (order: Order) => {
      if (busyNow(queryClient, order.id)) {
        return;
      }
      Alert.alert(
        t('translations:removal_withdraw_confirm_title'),
        t('translations:removal_withdraw_confirm_body'),
        [
          { text: t('translations:removal_withdraw_keep'), style: 'cancel' },
          {
            text: t('translations:removal_withdraw_confirm'),
            // Checked again here: two quick taps can open two dialogs before anything is on its way.
            onPress: () => {
              if (!busyNow(queryClient, order.id)) {
                mutate({ orderId: order.id });
              }
            },
          },
        ],
      );
    },
    [mutate, queryClient, t],
  );
};
