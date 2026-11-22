import React from 'react';
import renderer, { act } from 'react-test-renderer';
import '@app/localization/i18n';
import { StackOfferCell } from './StackOfferCell';
import { Order, StackStop } from '@app/types/types';
import ButtonSwipe from '../ButtonSwipe/ButtonSwipe';
import { ButtonOrder } from '../ButtonOrder/ButtonOrder';
import { Paralelogram } from '../Paralelogram/Paralelogram';

describe('StackOfferCell (spec 0048, row 80, AC-9, AC-10)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const stops: StackStop[] = [
    { deliveryId: 'order-1', stop: 'PICKUP' },
    { deliveryId: 'order-2', stop: 'PICKUP' },
    { deliveryId: 'order-1', stop: 'DROPOFF' },
    { deliveryId: 'order-2', stop: 'DROPOFF' },
  ];

  const order1: Order = {
    id: 'order-1',
    currencyCode: 'EUR',
    totalCompensation: 537, // €5.37
    pickupBusinessName: 'Pizza Roma',
    dropoffArea: 'Iasonos',
  } as Order;

  const order2: Order = {
    id: 'order-2',
    currencyCode: 'EUR',
    totalCompensation: 435, // €4.35
    pickupBusinessName: 'Souvlaki Bar',
    dropoffArea: 'Port Area',
  } as Order;

  it('AC-9 & AC-10: shows total pay and each order paid in full matching API figures', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <StackOfferCell
          order={order1}
          partner={order2}
          stops={stops}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={null}
          totalMillis={null}
        />,
      );
    });

    // 1. Total compensation is the sum of both full fees: 537 + 435 = 972 cents (€9.72)
    const totalNode = component!.root.findByProps({
      testID: 'stack-offer-total',
    });
    expect(totalNode.props.children).toBe('€9.72');

    // 2. Safety rule (AC-9): Each delivery in a stack is paid its own full fee
    const eachNode = component!.root.findByProps({
      testID: 'stack-offer-each',
    });
    expect(eachNode.props.children).toBe('Each paid in full: €5.37 and €4.35');

    act(() => {
      component.unmount();
    });
  });

  it('shows whole ride distance in km and time in minutes when ride is provided', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <StackOfferCell
          order={order1}
          partner={order2}
          stops={stops}
          ride={{ km: '3.5', minutes: 7 }}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={null}
          totalMillis={null}
        />,
      );
    });

    const rideNode = component!.root.findByProps({
      testID: 'stack-offer-ride',
    });
    expect(rideNode.props.children).toBe('3.5 km in all · About 7 min');

    act(() => {
      component.unmount();
    });
  });

  it('omits ride line when ride is undefined', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <StackOfferCell
          order={order1}
          partner={order2}
          stops={stops}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={null}
          totalMillis={null}
        />,
      );
    });

    const rideNodes = component!.root.findAllByProps({
      testID: 'stack-offer-ride',
    });
    expect(rideNodes).toHaveLength(0);

    act(() => {
      component.unmount();
    });
  });

  it('swiping Accept calls onAccept with the order', () => {
    const onAcceptMock = jest.fn();
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <StackOfferCell
          order={order1}
          partner={order2}
          stops={stops}
          onAccept={onAcceptMock}
          onDecline={jest.fn()}
        />,
      );
    });

    const swipeButton = component!.root.findByType(ButtonSwipe);
    act(() => {
      swipeButton.props.onSwiped(true);
    });

    expect(onAcceptMock).toHaveBeenCalledTimes(1);
    expect(onAcceptMock).toHaveBeenCalledWith(order1);

    act(() => {
      component.unmount();
    });
  });

  it('tapping Decline calls onDecline with the order', () => {
    const onDeclineMock = jest.fn();
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <StackOfferCell
          order={order1}
          partner={order2}
          stops={stops}
          onAccept={jest.fn()}
          onDecline={onDeclineMock}
        />,
      );
    });

    const declineButton = component!.root.findByType(ButtonOrder);
    act(() => {
      declineButton.props.onPress();
    });

    expect(onDeclineMock).toHaveBeenCalledTimes(1);
    expect(onDeclineMock).toHaveBeenCalledWith(order1);

    act(() => {
      component.unmount();
    });
  });

  it('draws countdown bar when offer has a deadline, hides waiting line', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <StackOfferCell
          order={order1}
          partner={order2}
          stops={stops}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={30000}
          totalMillis={60000}
          millisWaited={30000}
        />,
      );
    });

    const paralelograms = component!.root.findAllByType(Paralelogram);
    expect(paralelograms.length).toBeGreaterThan(0);

    const waitingNodes = component!.root.findAllByProps({
      testID: 'offer-waiting',
    });
    expect(waitingNodes).toHaveLength(0);

    act(() => {
      component.unmount();
    });
  });

  it('draws no bar and shows waiting text when offer has no deadline', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <StackOfferCell
          order={order1}
          partner={order2}
          stops={stops}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={null}
          totalMillis={null}
          millisWaited={120000} // 2 min
        />,
      );
    });

    const paralelograms = component!.root.findAllByType(Paralelogram);
    expect(paralelograms).toHaveLength(0);

    const waitingNode = component!.root.findByProps({
      testID: 'offer-waiting',
    });
    expect(waitingNode.props.children).toBe('Waiting 2 min');

    act(() => {
      component.unmount();
    });
  });
});
