import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { services } from '@app/services/service';
import { dropWaitingSteps } from '@app/services/jobStepOutbox';
import { Order } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import { waitSeconds } from '@app/utilities/waitClock';
import { serverMessage } from './useMoveDropoffPin';

// Seconds since the rider arrived, redrawn once a second while they wait
// (spec 0033, AC-5). Null when there is nothing to count.
export const useWaitClock = (
  arrivedOnPhone: number | null | undefined,
  waiting: boolean,
): number | null => {
  // Only changed to make React draw again; the value itself is not used.
  const [, setTick] = useState(0);
  const counting =
    waiting && arrivedOnPhone !== null && arrivedOnPhone !== undefined;

  useEffect(() => {
    if (!counting) {
      return;
    }
    const timer = setInterval(() => setTick(tick => tick + 1), 1000);
    // React runs this when the wait ends or the card goes away.
    return () => clearInterval(timer);
  }, [counting]);

  return counting ? waitSeconds(arrivedOnPhone, Date.now()) : null;
};

// Leaving a late order (spec 0033, AC-6): ask, send, and say what happened.
// Online only, like the hand back. `leavingId` is the delivery being sent, so
// its button can ignore taps.
export const useLeaveWait = (courierId: string | undefined) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [leavingId, setLeavingId] = useState<string | null>(null);
  // State updates land on the next render; this ref stops a second send
  // started in the same instant at once.
  const sendingRef = useRef(false);

  const send = useCallback(
    async (order: Order) => {
      if (sendingRef.current) {
        return;
      }
      sendingRef.current = true;
      setLeavingId(order.id);
      try {
        await services.orderService.leaveWait(order.id);
        // The order is no longer this rider's: none of its steps may go out.
        if (courierId) {
          await dropWaitingSteps(courierId, order.id).catch(error =>
            console.log('Could not drop the job steps', error),
          );
        }
        // The job leaves home now, not when the refetch lands.
        queryClient.setQueryData<Order[]>([QueryKeys.inProgressOrders], jobs =>
          jobs?.filter(job => job.id !== order.id),
        );
        // The rider is free for offers, and the wait may have just been paid.
        [
          QueryKeys.newOrders,
          QueryKeys.earningsSummary,
          QueryKeys.earningsDay,
          QueryKeys.earningsDelivery,
        ].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      } catch (error) {
        // The message only: the whole error would print the rider's token.
        console.log('Could not leave the order', (error as Error)?.message);
        const answered = axios.isAxiosError(error) && !!error.response;
        const notYours =
          axios.isAxiosError(error) && error.response?.status === 404;
        Alert.alert(
          !answered
            ? t('translations:hand_back_no_connection')
            : notYours
            ? t('translations:hand_back_not_yours')
            : serverMessage(error) ?? t('translations:leave_wait_failed'),
        );
      } finally {
        sendingRef.current = false;
        setLeavingId(null);
      }
      // Either way the server has the last word on the jobs.
      await queryClient.invalidateQueries({
        queryKey: [QueryKeys.inProgressOrders],
      });
    },
    [courierId, queryClient, t],
  );

  // Asks first; nothing is sent unless the rider confirms.
  const leaveWait = useCallback(
    (order: Order) => {
      if (leavingId) {
        return;
      }
      Alert.alert(
        t('translations:leave_wait_confirm_title'),
        t('translations:leave_wait_confirm_body'),
        [
          { text: t('translations:leave_wait_cancel'), style: 'cancel' },
          {
            text: t('translations:leave_wait_confirm'),
            onPress: () => {
              send(order);
            },
          },
        ],
      );
    },
    [leavingId, send, t],
  );

  return { leaveWait, leavingId };
};
