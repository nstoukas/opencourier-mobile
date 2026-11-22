import React from 'react';
import { render } from '@testing-library/react-native';
import '@app/localization/i18n';
import { StackStopList } from './StackStopList';
import { Order, StackStop } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';

describe('StackStopList (spec 0048, row 80, AC-10)', () => {
  const stops: StackStop[] = [
    { deliveryId: 'order-1', stop: 'PICKUP' },
    { deliveryId: 'order-2', stop: 'PICKUP' },
    { deliveryId: 'order-1', stop: 'DROPOFF' },
    { deliveryId: 'order-2', stop: 'DROPOFF' },
  ];

  const order1: Order = {
    id: 'order-1',
    status: OrderStatus.dispatched,
    pickupBusinessName: 'Pizza Roma',
    dropoffArea: 'Iasonos',
  } as Order;

  const order2: Order = {
    id: 'order-2',
    status: OrderStatus.dispatched,
    pickupBusinessName: 'Souvlaki Bar',
    dropoffArea: 'Port Area',
  } as Order;

  it('renders all four stops in order with correct place names on an offer', () => {
    const { getByTestId, getByText, queryByLabelText } = render(
      <StackStopList
        stops={stops}
        orders={[order1, order2]}
        isOffer={true}
      />,
    );

    expect(getByTestId('stack-stop-1')).toBeTruthy();
    expect(getByTestId('stack-stop-2')).toBeTruthy();
    expect(getByTestId('stack-stop-3')).toBeTruthy();
    expect(getByTestId('stack-stop-4')).toBeTruthy();

    // Verify stop texts
    expect(getByText('Pick up · Pizza Roma')).toBeTruthy();
    expect(getByText('Pick up · Souvlaki Bar')).toBeTruthy();
    expect(getByText('Drop off · Iasonos')).toBeTruthy();
    expect(getByText('Drop off · Port Area')).toBeTruthy();

    // On an offer: no stops are ticked done
    expect(queryByLabelText('Stop 1, done')).toBeNull();
    expect(queryByLabelText('Stop 2, done')).toBeNull();
    expect(queryByLabelText('Stop 3, done')).toBeNull();
    expect(queryByLabelText('Stop 4, done')).toBeNull();
  });

  it('on a job: marks finished stops as done and highlights the next stop', () => {
    // order1 is picked up (stop 1 is done). Stop 2 (order2 pickup) is next!
    const jobOrder1: Order = { ...order1, status: OrderStatus.picked_up };
    const jobOrder2: Order = { ...order2, status: OrderStatus.dispatched };

    const { getByLabelText } = render(
      <StackStopList
        stops={stops}
        orders={[jobOrder1, jobOrder2]}
        isOffer={false}
      />,
    );

    // Stop 1 is done
    expect(getByLabelText('Stop 1, done')).toBeTruthy();

    // Stop 2 is next (not done)
    expect(getByLabelText('Stop 2')).toBeTruthy();
  });

  it('falls back to pickupName or dropoffLocation street when businessName or dropoffArea are missing', () => {
    const fallbackOrder1: Order = {
      id: 'order-1',
      status: OrderStatus.dispatched,
      pickupName: 'Fallback Pickup',
      dropoffLocation: { street: 'Main St 123' } as any,
    } as Order;

    const { getByText } = render(
      <StackStopList
        stops={stops}
        orders={[fallbackOrder1, order2]}
        isOffer={true}
      />,
    );

    expect(getByText('Pick up · Fallback Pickup')).toBeTruthy();
    expect(getByText('Drop off · Main St 123')).toBeTruthy();
  });
});
