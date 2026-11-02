import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import Geolocation from 'react-native-geolocation-service';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { services } from '@app/services/service';
import { Order } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';

// Spec 0016 (AC-8): a fix less precise than this is refused; between the
// buildings of a street, a worse one could put the pin across the road.
export const PIN_MAX_ACCURACY_METRES = 50;
// How long the phone may look for a fresh location before giving up.
export const PIN_FIX_TIMEOUT_MS = 15_000;

type Fix = { latitude: number; longitude: number; accuracy: number };

// One fresh, high accuracy location, or null when the phone cannot get one in
// time. Read only when the rider tapped Move pin: the position is sent once,
// as the customer's door, and never kept (value 5).
const readFreshFix = (): Promise<Fix | null> =>
  new Promise(resolve => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: PIN_FIX_TIMEOUT_MS,
        maximumAge: 0,
      },
    );
  });

// A pin move's distance for the thank you line: whole metres under 1 km ("141 m"),
// km with one decimal above (a move of 30 m must not read "0 km").
export const formatPinDistance = (metres: number): string =>
  metres < 1000
    ? `${Math.round(metres)} m`
    : `${(metres / 1000).toFixed(1)} km`;

// A fix the phone says is within 50 m. Android reports 0 when it has no
// figure, iOS a negative number for an invalid fix: neither counts as precise.
export const isPreciseEnough = (accuracy: number): boolean =>
  Number.isFinite(accuracy) &&
  accuracy > 0 &&
  accuracy <= PIN_MAX_ACCURACY_METRES;

// The server's own sentence from a refusal (a 4xx such as the 409 "The pin is
// already where you stand"), if it sent one. A 5xx's text is not for riders.
// Also used by the hand back (spec 0020), whose 409s carry the rider's sentence.
export const serverMessage = (error: unknown): string | undefined => {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }
  const status = error.response?.status ?? 0;
  if (status < 400 || status >= 500) {
    return undefined;
  }
  const result = error.response?.data?.result;
  const message = Array.isArray(result) ? result[0]?.message : undefined;
  return typeof message === 'string' && message.trim() ? message : undefined;
};

// The rider's "Pin wrong? Set it where I stand" (spec 0016, AC-8): ask, read a
// fresh location, send it, and say what happened. `movingId` is the delivery
// whose move is running, so its button can show a spinner and ignore taps.
export const useMoveDropoffPin = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [movingId, setMovingId] = useState<string | null>(null);
  // State updates land on the next render; this ref stops a second Move pin
  // tapped in the same instant (two dialogs stacked on iOS) at once.
  const sendingRef = useRef(false);

  const send = useCallback(
    async (order: Order) => {
      if (sendingRef.current) {
        return;
      }
      sendingRef.current = true;
      setMovingId(order.id);
      try {
        const fix = await readFreshFix();
        if (!fix) {
          Alert.alert(
            t('translations:pin_move_title'),
            t('translations:pin_no_fix'),
          );
          return;
        }
        if (!isPreciseEnough(fix.accuracy)) {
          Alert.alert(
            t('translations:pin_move_title'),
            t('translations:pin_not_precise'),
          );
          return;
        }
        try {
          const answer = await services.orderService.moveDropoffPin({
            id: order.id,
            latitude: fix.latitude,
            longitude: fix.longitude,
          });
          Alert.alert(
            t('translations:pin_move_title'),
            t('translations:pin_moved', {
              distance: formatPinDistance(answer.distanceMetres),
            }),
          );
        } catch (error) {
          // The message only: the whole error would print the rider's token.
          console.log('Could not move the pin', (error as Error)?.message);
          const answered = axios.isAxiosError(error) && !!error.response;
          Alert.alert(
            t('translations:pin_move_title'),
            !answered
              ? t('translations:pin_no_connection')
              : serverMessage(error) ?? t('translations:pin_move_failed'),
          );
        }
        // The delivery now says whether its pin was moved (a success, or an
        // "already moved" refusal), so the button goes away.
        await queryClient.invalidateQueries({
          queryKey: [QueryKeys.inProgressOrders],
        });
      } finally {
        sendingRef.current = false;
        setMovingId(null);
      }
    },
    [queryClient, t],
  );

  // Asks first; nothing is read or sent unless the rider taps Move pin.
  const movePin = useCallback(
    (order: Order) => {
      if (movingId) {
        return;
      }
      Alert.alert(
        t('translations:pin_move_title'),
        t('translations:pin_move_body'),
        [
          { text: t('translations:pin_move_cancel'), style: 'cancel' },
          {
            text: t('translations:pin_move_confirm'),
            onPress: () => {
              send(order);
            },
          },
        ],
      );
    },
    [movingId, send, t],
  );

  return { movePin, movingId };
};
