import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { NextStep } from './NextStep';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import { MainScreens } from '@app/navigation/main/types';
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

describe('NextStep component (spec 0009, AC-2)', () => {
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

  describe('Mark as delivered button visibility', () => {
    it('shows Mark as delivered for picked_up, on_the_way and courier_arrived_at_dropoff_location', () => {
      const deliveredStatuses = [
        OrderStatus.picked_up,
        OrderStatus.on_the_way,
        OrderStatus.courier_arrived_at_dropoff_location,
      ];

      for (const status of deliveredStatuses) {
        const { unmount } = render(
          <NextStep
            order={{ ...baseOrder, status }}
            onOrderItemsListForCustomer={jest.fn()}
          />,
        );

        expect(
          screen.getByText(i18n.t('translations:mark_as_delivered')),
        ).toBeTruthy();
        unmount();
      }
    });

    it('does not show Mark as delivered for accepted, dispatched, or courier_arrived_at_pickup_location', () => {
      const nonDeliveredStatuses = [
        OrderStatus.accepted,
        OrderStatus.dispatched,
        OrderStatus.courier_arrived_at_pickup_location,
      ];

      for (const status of nonDeliveredStatuses) {
        const { unmount } = render(
          <NextStep
            order={{ ...baseOrder, status }}
            onOrderItemsListForCustomer={jest.fn()}
          />,
        );

        expect(
          screen.queryByText(i18n.t('translations:mark_as_delivered')),
        ).toBeNull();
        unmount();
      }
    });
  });

  describe('Button actions and job steps added', () => {
    it('tapping Arrived at pickup on an ACCEPTED order adds two steps: dispatched and arrived_at_pickup', async () => {
      render(
        <NextStep
          order={{ ...baseOrder, status: OrderStatus.accepted }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const arrivedBtn = screen.getByText(
        i18n.t('translations:arrived_at_pickup'),
      );
      await act(async () => {
        fireEvent.press(arrivedBtn);
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

    it('tapping Arrived at pickup on a DISPATCHED order adds one step: arrived_at_pickup', async () => {
      render(
        <NextStep
          order={{ ...baseOrder, status: OrderStatus.dispatched }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const arrivedBtn = screen.getByText(
        i18n.t('translations:arrived_at_pickup'),
      );
      await act(async () => {
        fireEvent.press(arrivedBtn);
      });

      expect(addJobStepsSpy).toHaveBeenCalledTimes(1);
      const added = addJobStepsSpy.mock.calls[0][0];
      expect(added.map((item: any) => item.step)).toEqual([
        'arrived_at_pickup',
      ]);
    });

    it('tapping Confirm items on a COURIER_ARRIVED_AT_PICKUP_LOCATION order adds picked_up', async () => {
      // If order is ACCEPTED, showPrePickupActions is true, but isCourierArrivedAtPickup is false
      // If we render with courier_arrived_at_pickup_location, Confirm items shows.
      // But if an ACCEPTED order somehow triggered confirmOrderItems (e.g. from useOrder directly),
      // let's verify useOrder's withDispatch adds dispatched + picked_up:
      // In NextStep, showConfirmOrderItems is only true when isCourierArrivedAtPickup is true.
      // When at courier_arrived_at_pickup_location, Confirm items adds one step: picked_up.
      render(
        <NextStep
          order={{
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_pickup_location,
          }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const confirmBtn = screen.getByText(i18n.t('translations:confirm_items'));
      await act(async () => {
        fireEvent.press(confirmBtn);
      });

      expect(addJobStepsSpy).toHaveBeenCalledTimes(1);
      const added = addJobStepsSpy.mock.calls[0][0];
      expect(added.map((item: any) => item.step)).toEqual(['picked_up']);
    });

    it('Confirm items on an ACCEPTED order adds dispatched + picked_up via useOrder', async () => {
      // Simulate calling confirmOrderItems on ACCEPTED order
      // (Even if NextStep only displays the button once arrived at pickup, useOrder withDispatch handles ACCEPTED)
      const { default: useOrder } = require('@app/hooks/useOrder');
      // Render dummy component to call hook
      let hookResult: any;
      const TestHook = () => {
        hookResult = useOrder();
        return null;
      };
      render(<TestHook />);

      await act(async () => {
        await hookResult.confirmOrderItems({
          ...baseOrder,
          status: OrderStatus.accepted,
        });
      });

      expect(addJobStepsSpy).toHaveBeenCalledTimes(1);
      const added = addJobStepsSpy.mock.calls[0][0];
      expect(added.map((item: any) => item.step)).toEqual([
        'dispatched',
        'picked_up',
      ]);
    });

    it('Mark as delivered adds arrived_at_dropoff then navigates when not yet at customer (picked_up)', async () => {
      render(
        <NextStep
          order={{ ...baseOrder, status: OrderStatus.picked_up }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const deliveredBtn = screen.getByText(
        i18n.t('translations:mark_as_delivered'),
      );
      await act(async () => {
        fireEvent.press(deliveredBtn);
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

    it('Mark as delivered adds arrived_at_dropoff then navigates when on_the_way', async () => {
      render(
        <NextStep
          order={{ ...baseOrder, status: OrderStatus.on_the_way }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const deliveredBtn = screen.getByText(
        i18n.t('translations:mark_as_delivered'),
      );
      await act(async () => {
        fireEvent.press(deliveredBtn);
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

    it('Mark as delivered adds nothing when already at the customer (courier_arrived_at_dropoff_location) and navigates', async () => {
      render(
        <NextStep
          order={{
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
          }}
          onOrderItemsListForCustomer={jest.fn()}
        />,
      );

      const deliveredBtn = screen.getByText(
        i18n.t('translations:mark_as_delivered'),
      );
      await act(async () => {
        fireEvent.press(deliveredBtn);
      });

      // No steps added because already at dropoff!
      expect(addJobStepsSpy).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(MainScreens.MarkAsDelivered, {
        order: expect.objectContaining({ id: baseOrder.id }),
      });
    });
  });
});
