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
      <StackStopList stops={stops} orders={[order1, order2]} isOffer={true} />,
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

  it('on an offer: uses dropoffArea only and never falls back to street name (spec 0019, row 80 review)', () => {
    // When dropoffArea is missing (or blanked by backend to protect privacy),
    // an offer must never fall back to dropoffLocation street.
    const fallbackOrder1: Order = {
      id: 'order-1',
      status: OrderStatus.dispatched,
      pickupName: 'Fallback Pickup',
      dropoffLocation: { street: 'Main St 123' } as any,
    } as Order;

    const { getByText, queryByText } = render(
      <StackStopList
        stops={stops}
        orders={[fallbackOrder1, order2]}
        isOffer={true}
      />,
    );

    // Pickup business name missing falls back to pickupName
    expect(getByText('Pick up · Fallback Pickup')).toBeTruthy();
    // Dropoff must NOT leak the street address on an offer
    expect(queryByText('Drop off · Main St 123')).toBeNull();
    // Instead it renders the label with empty place
    expect(getByText('Drop off · ')).toBeTruthy();
    // Normal order with dropoffArea is rendered
    expect(getByText('Drop off · Port Area')).toBeTruthy();
  });

  it('on a job: falls back to dropoffLocation street when dropoffArea is missing', () => {
    // On a job (accepted), the rider holds the delivery so showing street name is allowed
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
        isOffer={false}
      />,
    );

    expect(getByText('Pick up · Fallback Pickup')).toBeTruthy();
    expect(getByText('Drop off · Main St 123')).toBeTruthy();
  });

  describe('on an add-on offer (spec 0048, row 81, decision 81.12)', () => {
    // order1 is the rider's held job, order2 is the new offered add-on
    const heldJob: Order = {
      id: 'order-1',
      status: OrderStatus.picked_up,
      pickupBusinessName: 'Pizza Roma',
      dropoffArea: '',
      dropoffLocation: { street: 'Iolkou 5' } as any,
    } as Order;

    const addOnOffer: Order = {
      id: 'order-2',
      status: OrderStatus.dispatched,
      addOn: true,
      pickupBusinessName: 'Souvlaki Bar',
      dropoffArea: '',
      dropoffLocation: { street: 'Secret Street 42' } as any,
    } as Order;

    it('ticks stops that are finished on the held job, but leaves offered order stops unticked', () => {
      const { getByLabelText, queryByLabelText } = render(
        <StackStopList
          stops={stops}
          orders={[heldJob, addOnOffer]}
          isOffer={true}
          addOn={true}
        />,
      );

      // Stop 1 (heldJob PICKUP) is done because heldJob is picked_up
      expect(getByLabelText('Stop 1, done')).toBeTruthy();

      // Stop 2 (addOnOffer PICKUP) is NOT done because addOnOffer is an offer
      expect(queryByLabelText('Stop 2, done')).toBeNull();

      // Stop 3 (heldJob DROPOFF) is NOT done
      expect(queryByLabelText('Stop 3, done')).toBeNull();

      // Stop 4 (addOnOffer DROPOFF) is NOT done
      expect(queryByLabelText('Stop 4, done')).toBeNull();
    });

    it('held job uses street fallback when dropoffArea is missing, but add-on offer hides street (area rule)', () => {
      const { getByText, queryByText } = render(
        <StackStopList
          stops={stops}
          orders={[heldJob, addOnOffer]}
          isOffer={true}
          addOn={true}
        />,
      );

      // Held job dropoff shows street because rider already holds it
      expect(getByText('Drop off · Iolkou 5')).toBeTruthy();

      // Offered add-on dropoff hides street (never leaks customer address on an offer)
      expect(queryByText('Drop off · Secret Street 42')).toBeNull();
      expect(getByText('Drop off · ')).toBeTruthy();
    });
  });
});
