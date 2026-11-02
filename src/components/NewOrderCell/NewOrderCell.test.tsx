import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Order } from '@app/types/types';
import '@app/localization/i18n';
import ButtonSwipe from '../ButtonSwipe/ButtonSwipe';
import { ButtonOrder } from '../ButtonOrder/ButtonOrder';
import { NewOrderCell } from './NewOrderCell';
import { Paralelogram } from '../Paralelogram/Paralelogram';

jest.mock('@app/hooks/useUser', () => () => ({
  user: {
    id: 'courier-1',
    currentLocation: { latitude: 39.36, longitude: 22.94 },
  },
}));

describe('NewOrderCell (spec 0002, spec 0018, AC-7, AC-8, AC-9)', () => {
  let consoleErrorSpy: jest.SpyInstance;
  const keyWarnings: unknown[][] = [];

  beforeAll(() => {
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation((...args) => {
        if (
          args.some(
            arg => typeof arg === 'string' && arg.includes('unique "key" prop'),
          )
        ) {
          keyWarnings.push(args);
        }
      });
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

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

    const paralelograms = component!.root.findAllByType(Paralelogram);
    expect(paralelograms).toHaveLength(0);

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

  it('renders distances from route in "km" and never "mi" (AC-7)', async () => {
    let component: renderer.ReactTestRenderer;
    await act(async () => {
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
          millisWaited={1000}
          toRestaurant={{ km: '1.2', minutes: 4 }}
          toCustomer={{ km: '2.9', minutes: 5 }}
        />,
      );
    });

    const rootString = JSON.stringify(component!.toJSON());
    expect(rootString).toContain('1.2 km');
    expect(rootString).toContain('2.9 km');
    expect(rootString).not.toMatch(/\bmi\b/);
    expect(rootString).not.toContain('miles');

    act(() => {
      component.unmount();
    });
  });

  it('Accept swipe calls onAccept only when onSwiped(true); onSwiped(false) calls nothing (AC-9)', () => {
    const onAcceptMock = jest.fn();
    const onDeclineMock = jest.fn();

    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <NewOrderCell
          order={dummyOrder}
          autoAcceptOrders={false}
          onAccept={onAcceptMock}
          onDecline={onDeclineMock}
          onCopyCustomer={jest.fn()}
          onCopyRestaurant={jest.fn()}
        />,
      );
    });

    const swipe = component!.root.findByType(ButtonSwipe);
    expect(swipe.props.title).toBe('Accept');

    // Incomplete swipe (let go early)
    act(() => {
      swipe.props.onSwiped(false);
    });
    expect(onAcceptMock).not.toHaveBeenCalled();

    // Successful swipe
    act(() => {
      swipe.props.onSwiped(true);
    });
    expect(onAcceptMock).toHaveBeenCalledWith(dummyOrder);

    // Decline button
    const declineBtn = component!.root.findByType(ButtonOrder);
    act(() => {
      declineBtn.props.onPress();
    });
    expect(onDeclineMock).toHaveBeenCalledWith(dummyOrder);

    act(() => {
      component.unmount();
    });
  });

  it('countdown bar Paralelograms carry React keys and do not log key warning (Row 66, Clause 6)', () => {
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
          millisRemaining={30000}
          totalMillis={60000}
          millisWaited={30000}
        />,
      );
    });

    expect(keyWarnings).toHaveLength(0);

    act(() => {
      component.unmount();
    });
  });
});
