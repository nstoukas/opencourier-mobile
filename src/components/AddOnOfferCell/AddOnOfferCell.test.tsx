import React from 'react';
import renderer, { act } from 'react-test-renderer';
import '@app/localization/i18n';
import { AddOnOfferCell } from './AddOnOfferCell';
import { Order, StackStop } from '@app/types/types';
import ButtonSwipe from '../ButtonSwipe/ButtonSwipe';
import { ButtonOrder } from '../ButtonOrder/ButtonOrder';
import { Paralelogram } from '../Paralelogram/Paralelogram';

describe('AddOnOfferCell (spec 0048, row 81, AC-9, AC-10, cross check 2)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const stops: StackStop[] = [
    { deliveryId: 'job-1', stop: 'PICKUP' },
    { deliveryId: 'addon-1', stop: 'PICKUP' },
    { deliveryId: 'job-1', stop: 'DROPOFF' },
    { deliveryId: 'addon-1', stop: 'DROPOFF' },
  ];

  const heldJob: Order = {
    id: 'job-1',
    currencyCode: 'EUR',
    totalCompensation: 471, // €4.71
    pickupBusinessName: 'Pizza Roma',
    dropoffArea: 'Iasonos',
  } as Order;

  const addOnOrder: Order = {
    id: 'addon-1',
    currencyCode: 'EUR',
    totalCompensation: 325, // €3.25
    extraKm: 2.1,
    extraMinutes: 7,
    addOn: true,
    pickupBusinessName: 'Souvlaki Bar',
    dropoffArea: 'Port Area',
  } as Order;

  it('AC-9 & AC-10: displays add-on quote matching API figure and total pay with current job', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <AddOnOfferCell
          order={addOnOrder}
          job={heldJob}
          stops={stops}
          calm={false}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={null}
          totalMillis={null}
        />,
      );
    });

    // 1. Safety rule (AC-9): Add-on is paid its own full quote matching API figure
    const payNode = component!.root.findByProps({
      testID: 'add-on-offer-pay',
    });
    expect(payNode.props.children).toBe('€3.25');

    // 2. What it adds (AC-10): "+2.1 km, +7 min"
    const addsNode = component!.root.findByProps({
      testID: 'add-on-offer-adds',
    });
    expect(addsNode.props.children).toBe('+2.1 km, +7 min');

    // 3. Total with held job: 325 + 471 = 796 cents (€7.96), each paid in full
    const totalNode = component!.root.findByProps({
      testID: 'add-on-offer-total',
    });
    expect(totalNode.props.children).toBe(
      '€7.96 with your current job · each paid in full',
    );

    act(() => {
      component.unmount();
    });
  });

  it('cross check 2: shows "Answer only when you are stopped" when calm is true', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <AddOnOfferCell
          order={addOnOrder}
          job={heldJob}
          stops={stops}
          calm={true}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={null}
          totalMillis={null}
        />,
      );
    });

    const stoppedNode = component!.root.findByProps({
      testID: 'add-on-offer-stopped',
    });
    expect(stoppedNode.props.children).toBe('Answer only when you are stopped');

    act(() => {
      component.unmount();
    });
  });

  it('cross check 2: omits "Answer only when you are stopped" when calm is false', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <AddOnOfferCell
          order={addOnOrder}
          job={heldJob}
          stops={stops}
          calm={false}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={null}
          totalMillis={null}
        />,
      );
    });

    const stoppedNodes = component!.root.findAllByProps({
      testID: 'add-on-offer-stopped',
    });
    expect(stoppedNodes).toHaveLength(0);

    act(() => {
      component.unmount();
    });
  });

  it('omits adds line when extraKm or extraMinutes is null or undefined', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <AddOnOfferCell
          order={{ ...addOnOrder, extraKm: null, extraMinutes: null }}
          job={heldJob}
          stops={stops}
          calm={false}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={null}
          totalMillis={null}
        />,
      );
    });

    const addsNodes = component!.root.findAllByProps({
      testID: 'add-on-offer-adds',
    });
    expect(addsNodes).toHaveLength(0);

    act(() => {
      component.unmount();
    });
  });

  it('swiping Accept calls onAccept with the added order', () => {
    const onAcceptMock = jest.fn();
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <AddOnOfferCell
          order={addOnOrder}
          job={heldJob}
          stops={stops}
          calm={false}
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
    expect(onAcceptMock).toHaveBeenCalledWith(addOnOrder);

    act(() => {
      component.unmount();
    });
  });

  it('AC-7: tapping Decline calls onDecline with the added order (leaves held job untouched)', () => {
    const onDeclineMock = jest.fn();
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <AddOnOfferCell
          order={addOnOrder}
          job={heldJob}
          stops={stops}
          calm={false}
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
    expect(onDeclineMock).toHaveBeenCalledWith(addOnOrder);

    act(() => {
      component.unmount();
    });
  });

  it('draws countdown bar when offer has a deadline, hides waiting line', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <AddOnOfferCell
          order={addOnOrder}
          job={heldJob}
          stops={stops}
          calm={false}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={60000}
          totalMillis={120000} // doubled answer time for calm add on
          millisWaited={10000}
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
        <AddOnOfferCell
          order={addOnOrder}
          job={heldJob}
          stops={stops}
          calm={false}
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
