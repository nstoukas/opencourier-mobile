import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import Geolocation from 'react-native-geolocation-service';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { services } from '@app/services/service';
import { Order } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import { formatDistance } from '@app/utilities/geo';

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

// The server's own sentence from a refusal (a 409 such as "The pin is already
// where you stand"), if it sent one.
const serverMessage = (error: unknown): string | undefined => {
  if (!axios.isAxiosError(error)) {
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

  const send = useCallback(
    async (order: Order) => {
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
        if (fix.accuracy > PIN_MAX_ACCURACY_METRES) {
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
              distance: formatDistance(answer.distanceMetres),
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
