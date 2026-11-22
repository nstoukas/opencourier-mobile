import { useCallback } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import {
  Mutation,
  QueryClient,
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { services } from '@app/services/service';
import { Order, SplitBoxSize, SplitRequest } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import { serverMessage } from './useMoveDropoffPin';
import { forgetSplitDecision } from '@app/services/splitNotice/splitNotice';

// Spec 0047 (row 11): sending a split request and leaving an order dispatch did
// not split in time. Online only, like the removal request (spec 0035): each is
// sent once, and a send already on its way ignores another tap.
const SPLIT_MUTATION_KEY = 'splitRequest';

const splitFilters = (deliveryId: string | undefined) => ({
  mutationKey: [SPLIT_MUTATION_KEY],
  predicate: (mutation: Mutation<any, any, any>) =>
    mutation.state.variables?.orderId === deliveryId,
});

export const useSplitBusy = (deliveryId: string | undefined): boolean =>
  useIsMutating(splitFilters(deliveryId)) > 0;

const busyNow = (client: QueryClient, deliveryId: string): boolean =>
  client.isMutating(splitFilters(deliveryId)) > 0;

// Row 11 review: the request was made a moment ago, so on the phone's clock it starts now, and Leave comes
// the server's own gap later (no server clock needed for a difference). The card counts and shows Leave
// at once, even if the refetch that follows fails.
export const splitTimesOnPhone = (
  splitRequest: Pick<SplitRequest, 'createdAt' | 'leaveFrom'>,
  phoneNow: number,
): { splitCreatedAtOnPhone: number; splitLeaveFromOnPhone: number | null } => {
  const gap =
    new Date(splitRequest.leaveFrom).getTime() -
    new Date(splitRequest.createdAt).getTime();
  return {
    splitCreatedAtOnPhone: phoneNow,
    splitLeaveFromOnPhone: Number.isFinite(gap) ? phoneNow + gap : null,
  };
};

const setRequestOnJob = (
  client: QueryClient,
  deliveryId: string,
  splitRequest: SplitRequest,
) => {
  const times = splitTimesOnPhone(splitRequest, Date.now());
  client.setQueryData<Order[]>([QueryKeys.inProgressOrders], jobs =>
    jobs?.map(job =>
      job.id === deliveryId ? { ...job, splitRequest, ...times } : job,
    ),
  );
};

type SendParams = { orderId: string; legs: { boxSize: SplitBoxSize }[] };

export const useSendSplitRequest = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationKey: [SPLIT_MUTATION_KEY],
    networkMode: 'always',
    mutationFn: ({ orderId, legs }: SendParams) =>
      services.orderService.sendSplitRequest({ id: orderId, legs }),
    onSuccess: (request, { orderId }) => {
      // A new request: its answer is shown even if worded as an earlier one.
      forgetSplitDecision(orderId);
      setRequestOnJob(queryClient, orderId, request);
    },
    onError: error => {
      console.log(
        'Could not send the split request',
        (error as Error)?.message,
      );
      const answered = axios.isAxiosError(error) && !!error.response;
      const reason = serverMessage(error);
      Alert.alert(
        t('translations:split_send_failed_title'),
        !answered
          ? t('translations:split_send_no_connection')
          : reason ?? t('translations:split_send_failed'),
      );
    },
    onSettled: () => {
      // The job list carries the request with its times on the phone's clock.
      queryClient.invalidateQueries({ queryKey: [QueryKeys.inProgressOrders] });
    },
  });

  // `onSent` runs only on success, so a refusal keeps the screen open to try again.
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

// AC-8: asks first. Leaving cancels the order as the restaurant's: the rider is
// paid for the trip and the wait, and the restaurant sends it again.
export const useLeaveSplit = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationKey: [SPLIT_MUTATION_KEY],
    networkMode: 'always',
    mutationFn: ({ orderId }: { orderId: string }) =>
      services.orderService.leaveSplit(orderId),
    // As the ordinary Leave (useLeaveWait): the order is no longer this rider's,
    // so it leaves home now, not when the refetch lands; the rider is free for
    // offers, and the trip and the split wait may have just been paid
    // (agy's review of row 11).
    onSuccess: (_answer, { orderId }) => {
      queryClient.setQueryData<Order[]>([QueryKeys.inProgressOrders], jobs =>
        jobs?.filter(job => job.id !== orderId),
      );
      [
        QueryKeys.newOrders,
        QueryKeys.earningsMonth,
        QueryKeys.earningsDelivery,
      ].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: error => {
      console.log('Could not leave the order', (error as Error)?.message);
      Alert.alert(
        t('translations:split_leave_failed_title'),
        serverMessage(error) ?? t('translations:split_leave_failed'),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.inProgressOrders] });
    },
  });

  return useCallback(
    (order: Order) => {
      if (busyNow(queryClient, order.id)) {
        return;
      }
      Alert.alert(
        t('translations:split_leave_title'),
        t('translations:split_leave_body'),
        [
          { text: t('translations:split_leave_keep'), style: 'cancel' },
          {
            text: t('translations:split_leave_confirm'),
            style: 'destructive',
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
