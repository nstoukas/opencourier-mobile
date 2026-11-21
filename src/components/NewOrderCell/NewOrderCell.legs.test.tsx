// Spec 0046 (row 10, AC-7): the offer card says "Leg 1 of 2" when the order goes as
// several deliveries, and nothing for a single delivery.
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Order } from '@app/types/types';
import '@app/localization/i18n';
import { NewOrderCell } from './NewOrderCell';

jest.mock('@app/hooks/useUser', () => () => ({
  user: {
    id: 'courier-1',
    currentLocation: { latitude: 39.36, longitude: 22.94 },
  },
}));

describe('NewOrderCell leg line (spec 0046, AC-7)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const offer: Order = {
    id: 'order-1',
    currencyCode: 'EUR',
    deliveryFee: 450,
    pickupLocation: { latitude: 39.36, longitude: 22.94 },
    dropoffLocation: { latitude: 39.37, longitude: 22.95 },
    pickupLocationFormattedAddress: 'Pickup 1',
    dropoffLocationFormattedAddress: 'Dropoff 1',
    boxSize: 'LARGE',
  } as unknown as Order;

  const legNodesOf = (order: Order) => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <NewOrderCell
          order={order}
          autoAcceptOrders={false}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
        />,
      );
    });
    const nodes = component!.root.findAllByProps({ testID: 'offer-leg' });
    const sizes = component!.root.findAllByProps({ testID: 'offer-box-size' });
    const found = {
      legs: nodes.map(node => node.props.children),
      sizes: sizes.map(node => node.props.children),
    };
    act(() => {
      component.unmount();
    });
    return found;
  };

  it.each([
    [1, 2, 'Leg 1 of 2'],
    [2, 2, 'Leg 2 of 2'],
    [3, 4, 'Leg 3 of 4'],
  ])('leg %i of %i shows "%s" before the rider answers', (legNumber, legCount, expected) => {
    const found = legNodesOf({ ...offer, legNumber, legCount } as Order);

    expect(found.legs).toContain(expected);
  });

  it('shows the leg beside the size, not instead of it', () => {
    const found = legNodesOf({ ...offer, legNumber: 1, legCount: 2 } as Order);

    expect(found.legs).toContain('Leg 1 of 2');
    expect(found.sizes).toContain('Large order');
  });

  it('shows no leg line for a single delivery, or from a server that sends no legs', () => {
    for (const labels of [
      { legNumber: null, legCount: null },
      {},
      { legNumber: 1, legCount: null },
    ]) {
      const found = legNodesOf({ ...offer, ...labels } as Order);
      expect(found.legs).toHaveLength(0);
    }
  });
});
