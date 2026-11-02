import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { NextStep } from './NextStep';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import { MainScreens } from '@app/navigation/main/types';
import ButtonSwipe from '../ButtonSwipe/ButtonSwipe';
import * as jobStepOutbox from '@app/services/jobStepOutbox';
import i18n from '@app/localization/i18n';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  };
});

jest.mock('@app/hooks/useUser', () => () => ({
  user: { id: 'test-courier-id' },
}));

describe('NextStep component (spec 0009, spec 0018, AC-8, AC-9)', () => {
  let addJobStepsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jobStepOutbox.resetOutboxForTests();
    addJobStepsSpy = jest
      .spyOn(jobStepOutbox, 'addJobSteps')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    addJobStepsSpy.mockRestore();
  });

  const baseOrder: Order = {
    id: 'ord-123',
    number: '123',
    status: OrderStatus.dispatched,
    pickupBusinessName: 'Tasty Gyros',
    pickupName: 'Tasty Gyros',
    dropoffName: 'George K.',
    orderItems: [{ id: 'item-1', name: 'Gyros Pita', quantity: 2 }] as any,
  } as unknown as Order;

  describe('Waiting to send badge', () => {
    it('shows the "Waiting to send" badge when waitingToSend is true for non-dropped_off order', () => {
      const order = {
        ...baseOrder,
        status: OrderStatus.dispatched,
        waitingToSend: true,
      };

      render(
        <NextStep order={order} onOrderItemsListForCustomer={jest.fn()} />,
      );

      expect(
        screen.getByText(i18n.t('translations:waiting_to_send')),
      ).toBeTruthy();
      expect(
        screen.queryByText(i18n.t('translations:delivered_waiting_to_send')),
      ).toBeNull();
    });

    it('shows the delivered variant "Delivered, waiting to send" for a dropped_off order when waitingToSend is true', () => {
      const order = {
        ...baseOrder,
        status: OrderStatus.dropped_off,
        waitingToSend: true,
      };

      render(
        <NextStep order={order} onOrderItemsListForCustomer={jest.fn()} />,
      );

      expect(
        screen.getByText(i18n.t('translations:delivered_waiting_to_send')),
      ).toBeTruthy();
      expect(
        screen.queryByText(i18n.t('translations:waiting_to_send')),
      ).toBeNull();
    });

    it('does not show any waiting badge when waitingToSend is not true', () => {
      const order = {
        ...baseOrder,
        status: OrderStatus.dispatched,
        waitingToSend: false,
      };

      render(
        <NextStep order={order} onOrderItemsListForCustomer={jest.fn()} />,
      );

      expect(
        screen.queryByText(i18n.t('translations:waiting_to_send')),
      ).toBeNull();
      expect(
        screen.queryByText(i18n.t('translations:delivered_waiting_to_send')),
      ).toBeNull();
    });
  });

  describe('Step titles per status (spec 0018, AC-9)', () => {
    it('shows "Arrived at the restaurant" swipe for ACCEPTED and DISPATCHED', () => {
      for (const status of [OrderStatus.accepted, OrderStatus.dispatched]) {
        const { unmount, UNSAFE_getByType } = render(
          <NextStep
            order={{ ...baseOrder, status }}
            onOrderItemsListForCustomer={jest.fn()}
          />,
        );

        const swipe = UNSAFE_getByType(ButtonSwipe);
        expect(swipe.props.title).toBe(i18n.t('translations:arrived_at_pickup'));
        unmount();
      }
    });

    it('shows "Confirm items" swipe for COURIER_ARRIVED_AT_PICKUP_LOCATION', () => {
      const { UNSAFE_getByType } = render(
        <NextStep
          order={{
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_pickup_location,
          }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const swipe = UNSAFE_getByType(ButtonSwipe);
      expect(swipe.props.title).toBe(i18n.t('translations:confirm_items'));
    });

    it('shows "Arrived at the customer" swipe from PICKED_UP on', () => {
      const deliveredStatuses = [
        OrderStatus.picked_up,
        OrderStatus.on_the_way,
        OrderStatus.courier_arrived_at_dropoff_location,
      ];

      for (const status of deliveredStatuses) {
        const { unmount, UNSAFE_getByType } = render(
          <NextStep
            order={{ ...baseOrder, status }}
            onOrderItemsListForCustomer={jest.fn()}
          />,
        );

        const swipe = UNSAFE_getByType(ButtonSwipe);
        expect(swipe.props.title).toBe(
          i18n.t('translations:arrived_at_customer'),
        );
        unmount();
      }
    });
  });

  describe('Swipe actions and job steps added (Pin 8)', () => {
    it('swiping Arrived at pickup on an ACCEPTED order adds dispatched + arrived_at_pickup when swiped true; false adds nothing', async () => {
      const { UNSAFE_getByType } = render(
        <NextStep
          order={{ ...baseOrder, status: OrderStatus.accepted }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const swipe = UNSAFE_getByType(ButtonSwipe);

      // Incomplete swipe (false) does nothing
      await act(async () => {
        swipe.props.onSwiped(false);
      });
      expect(addJobStepsSpy).not.toHaveBeenCalled();

      // Successful swipe (true) adds dispatched and arrived_at_pickup
      await act(async () => {
        await swipe.props.onSwiped(true);
      });

      expect(addJobStepsSpy).toHaveBeenCalledTimes(1);
      const added = addJobStepsSpy.mock.calls[0][0];
      expect(added.map((item: any) => item.step)).toEqual([
        'dispatched',
        'arrived_at_pickup',
      ]);
      expect(added[0].courierId).toBe('test-courier-id');
      expect(added[0].deliveryId).toBe(baseOrder.id);
    });

    it('swiping Arrived at pickup on a DISPATCHED order adds one step: arrived_at_pickup', async () => {
      const { UNSAFE_getByType } = render(
        <NextStep
          order={{ ...baseOrder, status: OrderStatus.dispatched }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const swipe = UNSAFE_getByType(ButtonSwipe);

      await act(async () => {
        await swipe.props.onSwiped(true);
      });

      expect(addJobStepsSpy).toHaveBeenCalledTimes(1);
      const added = addJobStepsSpy.mock.calls[0][0];
      expect(added.map((item: any) => item.step)).toEqual(['arrived_at_pickup']);
    });

    it('swiping Confirm items on COURIER_ARRIVED_AT_PICKUP_LOCATION adds picked_up', async () => {
      const { UNSAFE_getByType } = render(
        <NextStep
          order={{
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_pickup_location,
          }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const swipe = UNSAFE_getByType(ButtonSwipe);

      await act(async () => {
        await swipe.props.onSwiped(true);
      });

      expect(addJobStepsSpy).toHaveBeenCalledTimes(1);
      const added = addJobStepsSpy.mock.calls[0][0];
      expect(added.map((item: any) => item.step)).toEqual(['picked_up']);
    });

    it('swiping Arrived at customer on picked_up adds arrived_at_dropoff and navigates', async () => {
      const { UNSAFE_getByType } = render(
        <NextStep
          order={{ ...baseOrder, status: OrderStatus.picked_up }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const swipe = UNSAFE_getByType(ButtonSwipe);

      // Incomplete swipe does nothing
      await act(async () => {
        swipe.props.onSwiped(false);
      });
      expect(addJobStepsSpy).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();

      // Successful swipe
      await act(async () => {
        await swipe.props.onSwiped(true);
      });

      expect(addJobStepsSpy).toHaveBeenCalledTimes(1);
      const added = addJobStepsSpy.mock.calls[0][0];
      expect(added.map((item: any) => item.step)).toEqual([
        'arrived_at_dropoff',
      ]);
      expect(mockNavigate).toHaveBeenCalledWith(MainScreens.MarkAsDelivered, {
        order: expect.objectContaining({ id: baseOrder.id }),
      });
    });

    it('swiping Arrived at customer when already at dropoff adds nothing and navigates', async () => {
      const { UNSAFE_getByType } = render(
        <NextStep
          order={{
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
          }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const swipe = UNSAFE_getByType(ButtonSwipe);

      await act(async () => {
        await swipe.props.onSwiped(true);
      });

      expect(addJobStepsSpy).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(MainScreens.MarkAsDelivered, {
        order: expect.objectContaining({ id: baseOrder.id }),
      });
    });

    it('draws a fresh swipe with a new key after a swipe attempt (AC-9)', async () => {
      const { UNSAFE_getByType } = render(
        <NextStep
          order={{ ...baseOrder, status: OrderStatus.dispatched }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const swipeBefore = UNSAFE_getByType(ButtonSwipe);
      expect((swipeBefore as any)._fiber.key).toBe(`${baseOrder.id}-${OrderStatus.dispatched}-0`);

      await act(async () => {
        await swipeBefore.props.onSwiped(true);
      });

      const swipeAfter = UNSAFE_getByType(ButtonSwipe);
      expect((swipeAfter as any)._fiber.key).toBe(`${baseOrder.id}-${OrderStatus.dispatched}-1`);
    });
  });
});
