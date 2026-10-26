import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventType } from '@notifee/react-native';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import { isHomeInFront } from '@app/navigation/navigationRef';
import {
  ACCEPT_ACTION,
  cancelOfferAlert,
  DECLINE_ACTION,
  showOfferAlert,
} from './offerAlert';
import { answerOffer } from './answerOffer';
import { markOfferAnswered, offerKeyOf } from './answeredOffers';
import { onNotificationEvent, onRemoteMessage } from './pushHandlers';

jest.mock('@app/navigation/navigationRef', () => ({
  isHomeInFront: jest.fn(),
}));

jest.mock('./offerAlert', () => ({
  cancelOfferAlert: jest.fn(),
  showOfferAlert: jest.fn(),
  ACCEPT_ACTION: 'accept',
  DECLINE_ACTION: 'decline',
}));

jest.mock('./answerOffer', () => ({
  answerOffer: jest.fn(),
}));

describe('pushHandlers (spec 0003, AC-6, AC-12)', () => {
  const newOfferData = {
    type: 'NEW_DELIVERY_OFFER',
    deliveryId: 'del-push-1',
    offeredAt: '2026-10-26T10:00:00.000Z',
    offerExpiresAt: '2026-10-26T10:01:00.000Z',
    serverNow: '2026-10-26T10:00:10.000Z',
    payTotal: '500',
    currencyCode: 'EUR',
    restaurantName: 'Gyros Express',
    dropoffArea: 'Center',
    distanceKm: '2.0',
    minutes: '10',
    insistent: '0',
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    queryClient.clear();
    await AsyncStorage.clear();
    await AsyncStorage.setItem('token', 'courier-valid-token');
    (isHomeInFront as jest.Mock).mockResolvedValue(false);
    AppState.currentState = 'active';
  });

  afterEach(() => {
    queryClient.clear();
    jest.useRealTimers();
  });

  describe('AC-6: OFFER_ENDED push message', () => {
    it('cancels the alert, removes offer from TanStack Query cache, and invalidates newOrders', async () => {
      queryClient.setQueryData(
        [QueryKeys.newOrders],
        [{ id: 'del-keep' }, { id: 'del-ended-1' }],
      );

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      await onRemoteMessage(
        {
          data: {
            type: 'OFFER_ENDED',
            deliveryId: 'del-ended-1',
            reason: 'EXPIRED',
          },
        } as any,
        'background',
      );

      // Cancels the alert with id = deliveryId
      expect(cancelOfferAlert).toHaveBeenCalledWith('del-ended-1');

      // Query cache is updated in place
      const cached = queryClient.getQueryData<any[]>([QueryKeys.newOrders]);
      expect(cached?.map(o => o.id)).toEqual(['del-keep']);

      // Refetches
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.newOrders],
      });
    });
  });

  describe('AC-12: Foreground rule & screen placement', () => {
    it('with Home in front and app active, no system notification is posted', async () => {
      (isHomeInFront as jest.Mock).mockResolvedValue(true);
      AppState.currentState = 'active';

      await onRemoteMessage({ data: newOfferData } as any, 'foreground');

      // No system alert posted because Home is in front
      expect(showOfferAlert).not.toHaveBeenCalled();
    });

    it('with Home as current route but AppState not active (e.g. background), still posts an alert', async () => {
      (isHomeInFront as jest.Mock).mockResolvedValue(true);
      AppState.currentState = 'background';

      await onRemoteMessage({ data: newOfferData } as any, 'foreground');

      // Home counts as in front only when the app is active; in background it must still post an alert
      expect(showOfferAlert).toHaveBeenCalledTimes(1);
      expect(showOfferAlert).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryId: 'del-push-1' }),
        expect.any(Number),
        'full-screen',
      );
    });

    it('on any other screen (Home not in front), posts a heads-up alert with id = deliveryId', async () => {
      (isHomeInFront as jest.Mock).mockResolvedValue(false);
      AppState.currentState = 'active';

      await onRemoteMessage({ data: newOfferData } as any, 'foreground');

      expect(showOfferAlert).toHaveBeenCalledTimes(1);
      expect(showOfferAlert).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryId: 'del-push-1' }),
        expect.any(Number),
        'heads-up',
      );
    });

    it('in background, posts a full-screen alert with id = deliveryId', async () => {
      AppState.currentState = 'background';

      await onRemoteMessage({ data: newOfferData } as any, 'background');

      expect(showOfferAlert).toHaveBeenCalledTimes(1);
      expect(showOfferAlert).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryId: 'del-push-1' }),
        expect.any(Number),
        'full-screen',
      );
    });

    it('a repeat of the same offer replaces rather than duplicates (uses same delivery id)', async () => {
      (isHomeInFront as jest.Mock).mockResolvedValue(false);

      await onRemoteMessage({ data: newOfferData } as any, 'background');
      await onRemoteMessage({ data: newOfferData } as any, 'background');

      expect(showOfferAlert).toHaveBeenCalledTimes(2);
      expect(showOfferAlert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ deliveryId: 'del-push-1' }),
        expect.any(Number),
        'full-screen',
      );
      expect(showOfferAlert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ deliveryId: 'del-push-1' }),
        expect.any(Number),
        'full-screen',
      );
    });
  });

  describe('Deduplication & session guards', () => {
    it('does not post alert if phone has no logged in user (token missing)', async () => {
      await AsyncStorage.removeItem('token');

      await onRemoteMessage({ data: newOfferData } as any, 'background');

      expect(showOfferAlert).not.toHaveBeenCalled();
    });

    it('does not post alert if offer has already been answered on this phone', async () => {
      markOfferAnswered(
        offerKeyOf(newOfferData.deliveryId, newOfferData.offeredAt),
      );

      await onRemoteMessage({ data: newOfferData } as any, 'background');

      expect(showOfferAlert).not.toHaveBeenCalled();
    });
  });

  describe('onNotificationEvent', () => {
    const validNotificationData = {
      kind: 'offer-alert',
      deliveryId: 'del-action-1',
      offeredAt: '2026-10-26T10:00:00.000Z',
      deadlineAt: '1700000000000',
      payTotal: '500',
      currencyCode: 'EUR',
      restaurantName: 'Gyros Express',
      dropoffArea: 'Center',
      distanceKm: '2.0',
      minutes: '10',
      insistent: '',
    };

    it('calls answerOffer with accept when Accept button is pressed', async () => {
      await onNotificationEvent({
        type: EventType.ACTION_PRESS,
        detail: {
          pressAction: { id: ACCEPT_ACTION },
          notification: { data: validNotificationData },
        },
      } as any);

      expect(answerOffer).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryId: 'del-action-1' }),
        'accept',
      );
    });

    it('calls answerOffer with decline when Decline button is pressed', async () => {
      await onNotificationEvent({
        type: EventType.ACTION_PRESS,
        detail: {
          pressAction: { id: DECLINE_ACTION },
          notification: { data: validNotificationData },
        },
      } as any);

      expect(answerOffer).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryId: 'del-action-1' }),
        'decline',
      );
    });

    it('ignores non-action press events and unknown action ids', async () => {
      // Tap on notification body (DISMISSED, PRESS, etc.)
      await onNotificationEvent({
        type: EventType.DISMISSED,
        detail: {},
      } as any);
      expect(answerOffer).not.toHaveBeenCalled();

      // Unknown action id
      await onNotificationEvent({
        type: EventType.ACTION_PRESS,
        detail: {
          pressAction: { id: 'unknown-action' },
          notification: { data: validNotificationData },
        },
      } as any);
      expect(answerOffer).not.toHaveBeenCalled();
    });
  });
});
