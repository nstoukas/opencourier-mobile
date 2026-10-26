import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Order } from '@app/types/types';
import '@app/localization/i18n';

jest.mock('../Map/Map', () => {
  const { View } = require('react-native');
  return () => <View testID="mock-map" />;
});

jest.mock('@app/utilities/geo', () => ({
  ...jest.requireActual('@app/utilities/geo'),
  getDistance: jest.fn().mockResolvedValue({ distance: 1000, duration: 60 }),
}));

jest.mock('@app/hooks/useUser', () => () => ({
  user: {
    id: 'courier-1',
    currentLocation: { latitude: 39.36, longitude: 22.94 },
  },
}));

import { NewOrderCell } from './NewOrderCell';
import { Paralelogram } from '../Paralelogram/Paralelogram';

describe('NewOrderCell (spec 0002, AC-4 & AC-9 UI presentation)', () => {
  const dummyOrder: Order = {
    id: 'order-1',
    currencyCode: 'EUR',
    deliveryFee: 450,
    pickupLocation: { latitude: 39.36, longitude: 22.94 },
    dropoffLocation: { latitude: 39.37, longitude: 22.95 },
    pickupLocationFormattedAddress: 'Pickup 1',
    dropoffLocationFormattedAddress: 'Dropoff 1',
  } as unknown as Order;

  it('draws no bar and shows "Waiting less than 1 min" when offer has no deadline and waited < 1 min', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <NewOrderCell
          order={dummyOrder}
          autoAcceptOrders={false}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          onCopyCustomer={jest.fn()}
          onCopyRestaurant={jest.fn()}
          millisRemaining={null} // Expiry off: no deadline
          totalMillis={null}
          millisWaited={25000} // 25 seconds
        />,
      );
    });

    // No countdown bar (Paralelograms) drawn
    const paralelograms = component!.root.findAllByType(Paralelogram);
    expect(paralelograms).toHaveLength(0);

    // "Waiting less than 1 min" line is shown
    const waitingNode = component!.root.findByProps({
      testID: 'offer-waiting',
    });
    expect(waitingNode.props.children).toBe('Waiting less than 1 min');

    act(() => {
      component.unmount();
    });
  });

  it('draws no bar and shows "Waiting 3 min" when waited time is 3 minutes', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <NewOrderCell
          order={dummyOrder}
          autoAcceptOrders={false}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          onCopyCustomer={jest.fn()}
          onCopyRestaurant={jest.fn()}
          millisRemaining={null}
          totalMillis={null}
          millisWaited={180000} // 3 minutes
        />,
      );
    });

    const paralelograms = component!.root.findAllByType(Paralelogram);
    expect(paralelograms).toHaveLength(0);

    const waitingNode = component!.root.findByProps({
      testID: 'offer-waiting',
    });
    expect(waitingNode.props.children).toBe('Waiting 3 min');

    act(() => {
      component.unmount();
    });
  });

  it('draws countdown bar and hides waiting line when offer has a deadline', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <NewOrderCell
          order={dummyOrder}
          autoAcceptOrders={false}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          onCopyCustomer={jest.fn()}
          onCopyRestaurant={jest.fn()}
          millisRemaining={30000} // 30s left
          totalMillis={60000} // 60s total
          millisWaited={30000}
        />,
      );
    });

    // Countdown bar (Paralelograms) is drawn under buttons
    const paralelograms = component!.root.findAllByType(Paralelogram);
    expect(paralelograms.length).toBeGreaterThan(0);

    // "Waiting X min" line is NOT shown when there is a deadline
    const waitingNodes = component!.root.findAllByProps({
      testID: 'offer-waiting',
    });
    expect(waitingNodes).toHaveLength(0);

    act(() => {
      component.unmount();
    });
  });
});
