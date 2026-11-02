import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Order } from '@app/types/types';
import '@app/localization/i18n';
import ButtonSwipe, { BUTTON_WIDTH } from '../ButtonSwipe/ButtonSwipe';
import { ButtonOrder } from '../ButtonOrder/ButtonOrder';
import { NewOrderCell } from './NewOrderCell';
import { Paralelogram } from '../Paralelogram/Paralelogram';
import { control } from '@app/styles/theme';

jest.mock('@app/hooks/useUser', () => () => ({
  user: {
    id: 'courier-1',
    currentLocation: { latitude: 39.36, longitude: 22.94 },
  },
}));

describe('NewOrderCell (spec 0002, spec 0018, spec 0019, AC-3, AC-5, AC-7, AC-8, AC-9)', () => {
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
    const orderWithTrip: Order = {
      ...dummyOrder,
      offerTrip: {
        toPickupMetres: 1200,
        toDropoffMetres: 2900,
        minutes: 9,
      },
    };

    let component: renderer.ReactTestRenderer;
    await act(async () => {
      component = renderer.create(
        <NewOrderCell
          order={orderWithTrip}
          autoAcceptOrders={false}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={null}
          totalMillis={null}
          millisWaited={1000}
        />,
      );
    });

    const rootString = JSON.stringify(component!.toJSON());
    expect(rootString).toContain('1.2 km to the restaurant · 2.9 km to the customer');
    expect(rootString).toContain('About 9 min');
    expect(rootString).not.toMatch(/\bmi\b/);
    expect(rootString).not.toContain('miles');

    act(() => {
      component.unmount();
    });
  });

  it('shows in order: total, waiting line, distances, minutes, restaurant name, dropoffArea; and hides customer name, items, full address, copy button, €/km, mi (Pin 2, spec 0019, AC-3)', () => {
    const fullOrder: Order = {
      ...dummyOrder,
      totalCompensation: 550, // €5.50
      pickupBusinessName: 'Pizza Roma',
      dropoffArea: 'Downtown Area',
      dropoffName: 'Secret Customer',
      pickupLocationFormattedAddress: '123 Restaurant Street',
      dropoffLocationFormattedAddress: '456 Customer Avenue',
      orderItems: [
        { name: 'Secret Pizza Item', quantity: 2, price: 1000 },
      ] as any,
      offerTrip: {
        toPickupMetres: 1234,
        toDropoffMetres: 2850,
        minutes: 9,
      },
    } as unknown as Order;

    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <NewOrderCell
          order={fullOrder}
          autoAcceptOrders={false}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={null}
          totalMillis={null}
          millisWaited={25000}
        />,
      );
    });

    const rootJson = JSON.stringify(component!.toJSON());

    // 1. Shows exactly in this order:
    // Total (€5.50) -> Waiting line -> Distances -> Minutes -> Restaurant name -> Dropoff area
    const totalIndex = rootJson.indexOf('€5.50');
    const waitingIndex = rootJson.indexOf('Waiting less than 1 min');
    const distancesIndex = rootJson.indexOf(
      '1.2 km to the restaurant · 2.9 km to the customer',
    );
    const minutesIndex = rootJson.indexOf('About 9 min');
    const restaurantIndex = rootJson.indexOf('Pizza Roma');
    const areaIndex = rootJson.indexOf('Downtown Area');

    expect(totalIndex).toBeGreaterThan(-1);
    expect(waitingIndex).toBeGreaterThan(totalIndex);
    expect(distancesIndex).toBeGreaterThan(waitingIndex);
    expect(minutesIndex).toBeGreaterThan(distancesIndex);
    expect(restaurantIndex).toBeGreaterThan(minutesIndex);
    expect(areaIndex).toBeGreaterThan(restaurantIndex);

    // 2. Also assert by testIDs
    expect(
      component!.root.findByProps({ testID: 'offer-waiting' }).props.children,
    ).toBe('Waiting less than 1 min');
    expect(
      component!.root.findByProps({ testID: 'offer-trip-distances' }).props
        .children,
    ).toBe('1.2 km to the restaurant · 2.9 km to the customer');
    expect(
      component!.root.findByProps({ testID: 'offer-trip-minutes' }).props
        .children,
    ).toBe('About 9 min');
    expect(
      component!.root.findByProps({ testID: 'offer-restaurant' }).props
        .children,
    ).toBe('Pizza Roma');
    expect(
      component!.root.findByProps({ testID: 'offer-dropoff-area' }).props
        .children,
    ).toBe('Downtown Area');

    // 3. Does NOT show:
    // Customer name (dropoffName)
    expect(rootJson).not.toContain('Secret Customer');
    // Any order item
    expect(rootJson).not.toContain('Secret Pizza Item');
    // Full pickup or drop off address
    expect(rootJson).not.toContain('123 Restaurant Street');
    expect(rootJson).not.toContain('456 Customer Avenue');
    // Copy buttons
    expect(rootJson).not.toContain('copy');
    expect(rootJson).not.toContain('Copy');
    // "€/km" or "/km"
    expect(rootJson).not.toContain('€/km');
    expect(rootJson).not.toContain('/km');
    // "mi" or "miles"
    expect(rootJson).not.toMatch(/\bmi\b/);
    expect(rootJson).not.toContain('miles');

    act(() => {
      component.unmount();
    });
  });

  it('leaves out dropoffArea when empty or undefined (spec 0019, AC-3)', () => {
    const orderWithoutArea: Order = {
      ...dummyOrder,
      pickupBusinessName: 'Pizza Roma',
      dropoffArea: undefined,
    } as unknown as Order;

    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <NewOrderCell
          order={orderWithoutArea}
          autoAcceptOrders={false}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={null}
          totalMillis={null}
          millisWaited={1000}
        />,
      );
    });

    const areaNodes = component!.root.findAllByProps({
      testID: 'offer-dropoff-area',
    });
    expect(areaNodes).toHaveLength(0);

    act(() => {
      component.unmount();
    });
  });

  it('Accept swipe has height control.offer (100) and calls onAccept once on full swipe; Decline calls onDecline and has BUTTON_WIDTH (Pin 3, AC-5, AC-9)', () => {
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
        />,
      );
    });

    const swipeBefore = component!.root.findByType(ButtonSwipe);
    expect(swipeBefore.props.title).toBe('Accept');
    // Pin 3: Accept is a ButtonSwipe with height control.offer (100)
    expect(swipeBefore.props.height).toBe(control.offer);
    expect(swipeBefore.props.height).toBe(100);
    expect((swipeBefore as any)._fiber.key).toBe('0');

    // Incomplete swipe (half swipe / let go early) calls nothing and does not redraw
    act(() => {
      swipeBefore.props.onSwiped(false);
    });
    expect(onAcceptMock).not.toHaveBeenCalled();
    const swipeAfterHalf = component!.root.findByType(ButtonSwipe);
    expect((swipeAfterHalf as any)._fiber.key).toBe('0');

    // Successful full swipe calls onAccept once and redraws with new attempt key
    act(() => {
      swipeBefore.props.onSwiped(true);
    });
    expect(onAcceptMock).toHaveBeenCalledTimes(1);
    expect(onAcceptMock).toHaveBeenCalledWith(dummyOrder);

    const swipeAfterFull = component!.root.findByType(ButtonSwipe);
    expect((swipeAfterFull as any)._fiber.key).toBe('1');

    // Decline button: calls onDecline and has BUTTON_WIDTH as its width
    const declineBtn = component!.root.findByType(ButtonOrder);
    expect(declineBtn.props.style).toEqual(
      expect.objectContaining({ width: BUTTON_WIDTH }),
    );
    act(() => {
      declineBtn.props.onPress();
    });
    expect(onDeclineMock).toHaveBeenCalledTimes(1);
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
