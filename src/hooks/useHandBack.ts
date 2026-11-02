import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { services } from '@app/services/service';
import { dropWaitingSteps } from '@app/services/jobStepOutbox';
import { Order } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import { handBackSecondsLeft } from '@app/utilities/handBackWindow';
import { serverMessage } from './useMoveDropoffPin';

// Seconds left in a job's free hand back window (spec 0020, AC-9), counted on
// the phone's clock. The screen is drawn again once a second, and only while
// the window is open: at 0 the timer stops and nothing ticks.
export const useHandBackCountdown = (
  untilOnPhone: number | null | undefined,
): number => {
  // Only changed to make React draw again; the value itself is not used.
  const [, setTick] = useState(0);
  const secondsLeft = handBackSecondsLeft(untilOnPhone, Date.now());
  const open = secondsLeft > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = setInterval(() => setTick(tick => tick + 1), 1000);
    // React runs this when the window closes or the card goes away.
    return () => clearInterval(timer);
  }, [open]);

  return secondsLeft;
};

// The rider's Hand back (spec 0020, AC-9): ask, send, and say what happened.
// Online only, like the pin move: with no signal it says so and sends nothing
// later. `courierId` is the rider logged in, whose waiting steps for the
// delivery are dropped once it is handed back. `handingBackId` is the delivery
// being sent, so its button can spin and ignore taps.
export const useHandBack = (courierId: string | undefined) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [handingBackId, setHandingBackId] = useState<string | null>(null);
  // State updates land on the next render; this ref stops a second send
  // started in the same instant at once.
  const sendingRef = useRef(false);

  const send = useCallback(
    async (order: Order) => {
      if (sendingRef.current) {
        return;
      }
      sendingRef.current = true;
      setHandingBackId(order.id);
      try {
        await services.orderService.handBack(order.id);
        // The order is no longer this rider's: none of its steps may go out.
        if (courierId) {
          await dropWaitingSteps(courierId, order.id).catch(error =>
            console.log('Could not drop the handed back job steps', error),
          );
        }
        // The job leaves home now, not when the refetch lands.
        queryClient.setQueryData<Order[]>([QueryKeys.inProgressOrders], jobs =>
          jobs?.filter(job => job.id !== order.id),
        );
        queryClient.invalidateQueries({ queryKey: [QueryKeys.newOrders] });
      } catch (error) {
        // The message only: the whole error would print the rider's token.
        console.log('Could not hand the order back', (error as Error)?.message);
        const answered = axios.isAxiosError(error) && !!error.response;
        // A 409 carries the server's sentence (at the restaurant, the window
        // is over, the order changed); a 404 says it is not theirs.
        Alert.alert(
          !answered
            ? t('translations:hand_back_no_connection')
            : serverMessage(error) ?? t('translations:hand_back_failed'),
        );
      } finally {
        sendingRef.current = false;
        setHandingBackId(null);
      }
      // Either way the server has the last word on the jobs.
      await queryClient.invalidateQueries({
        queryKey: [QueryKeys.inProgressOrders],
      });
    },
    [courierId, queryClient, t],
  );

  // Asks first; nothing is sent unless the rider confirms.
  const handBack = useCallback(
    (order: Order) => {
      if (handingBackId) {
        return;
      }
      Alert.alert(
        t('translations:hand_back_confirm_title'),
        t('translations:hand_back_confirm_body'),
        [
          { text: t('translations:hand_back_cancel'), style: 'cancel' },
          {
            text: t('translations:hand_back_confirm'),
            onPress: () => {
              send(order);
            },
          },
        ],
      );
    },
    [handingBackId, send, t],
  );

  return { handBack, handingBackId };
};
