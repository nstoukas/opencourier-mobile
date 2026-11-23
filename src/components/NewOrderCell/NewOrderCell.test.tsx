import React from 'react';
import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { Order } from '@app/types/types';
import '@app/localization/i18n';
import { OfferAnswers } from '../OfferAnswers/OfferAnswers';
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

  it('hides countdown bar when autoAcceptOrders is true even when offer has a deadline (decision 130.3)', () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <NewOrderCell
          order={dummyOrder}
          autoAcceptOrders={true}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
          millisRemaining={30000}
          totalMillis={60000}
          millisWaited={30000}
        />,
      );
    });

    const paralelograms = component!.root.findAllByType(Paralelogram);
    expect(paralelograms).toHaveLength(0);

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
    expect(rootString).toContain(
      '1.2 km to the restaurant · 2.9 km to the customer',
    );
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

  it('renders OfferAnswers with Accept (100 tall, flex 2) and Decline (100 tall, flex 1) and calls onAccept / onDecline with order (Clause 1, 2, 5)', () => {
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

    const offerAnswers = component!.root.findByType(OfferAnswers);
    expect(offerAnswers.props.acceptLabel).toBe('Accept');
    expect(offerAnswers.props.acceptHint).toBe('Hold to take this order');

    const acceptBtn = component!.root.findByProps({ testID: 'offer-accept' });
    const acceptStyle = StyleSheet.flatten(acceptBtn.props.style);
    expect(acceptStyle.height).toBe(control.offer);
    expect(acceptStyle.height).toBe(100);
    expect(acceptStyle.flex).toBe(2);

    const declineBtn = component!.root.findByProps({ testID: 'offer-decline' });
    const declineStyle = StyleSheet.flatten(declineBtn.props.style);
    expect(declineStyle.height).toBe(control.offer);
    expect(declineStyle.height).toBe(100);
    expect(declineStyle.flex).toBe(1);

    // Holding or activating Accept calls onAccept with order
    act(() => {
      acceptBtn.props.onHeld();
    });
    expect(onAcceptMock).toHaveBeenCalledTimes(1);
    expect(onAcceptMock).toHaveBeenCalledWith(dummyOrder);

    // Holding or activating Decline calls onDecline with order
    act(() => {
      declineBtn.props.onHeld();
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

  describe('Offer card box size (spec 0043, AC-7)', () => {
    it.each([
      ['SMALL', 'Small order'],
      ['MEDIUM', 'Medium order'],
      ['LARGE', 'Large order'],
    ] as const)(
      'shows the size line for %s as "%s"',
      (boxSize, expectedText) => {
        let component: renderer.ReactTestRenderer;
        act(() => {
          component = renderer.create(
            <NewOrderCell
              order={{ ...dummyOrder, boxSize }}
              autoAcceptOrders={false}
              onAccept={jest.fn()}
              onDecline={jest.fn()}
            />,
          );
        });

        const sizeNode = component!.root.findByProps({
          testID: 'offer-box-size',
        });
        expect(sizeNode.props.children).toBe(expectedText);

        act(() => {
          component.unmount();
        });
      },
    );

    it('shows no size line when the offer has no size, null, or an unknown size', () => {
      for (const boxSize of [undefined, null, 'HUGE' as any]) {
        let component: renderer.ReactTestRenderer;
        act(() => {
          component = renderer.create(
            <NewOrderCell
              order={{ ...dummyOrder, boxSize }}
              autoAcceptOrders={false}
              onAccept={jest.fn()}
              onDecline={jest.fn()}
            />,
          );
        });

        const sizeNodes = component!.root.findAllByProps({
          testID: 'offer-box-size',
        });
        expect(sizeNodes).toHaveLength(0);

        act(() => {
          component.unmount();
        });
      }
    });

    it('shows no box gauge or fill and shows no percentage on the offer card', () => {
      for (const boxSize of ['SMALL', 'MEDIUM', 'LARGE', undefined] as const) {
        let component: renderer.ReactTestRenderer;
        act(() => {
          component = renderer.create(
            <NewOrderCell
              order={{ ...dummyOrder, boxSize }}
              autoAcceptOrders={false}
              onAccept={jest.fn()}
              onDecline={jest.fn()}
            />,
          );
        });

        // No gauge or fill testIDs
        expect(
          component!.root.findAllByProps({ testID: 'box-gauge' }),
        ).toHaveLength(0);
        expect(
          component!.root.findAllByProps({ testID: 'box-fill' }),
        ).toHaveLength(0);

        // No percentage character anywhere in rendered texts
        const textNodes = component!.root.findAllByType(Text);
        for (const node of textNodes) {
          const content = Array.isArray(node.props.children)
            ? node.props.children.join('')
            : String(node.props.children ?? '');
          expect(content).not.toContain('%');
        }

        act(() => {
          component.unmount();
        });
      }
    });
  });

  describe('OfferAnswers and answersBelow prop (Clause 6)', () => {
    it('renders OfferAnswers when answersBelow is false or omitted', () => {
      let component: renderer.ReactTestRenderer;
      act(() => {
        component = renderer.create(
          <NewOrderCell
            order={dummyOrder}
            autoAcceptOrders={false}
            onAccept={jest.fn()}
            onDecline={jest.fn()}
          />,
        );
      });

      const offerAnswers = component!.root.findAllByType(OfferAnswers);
      expect(offerAnswers).toHaveLength(1);

      act(() => {
        component.unmount();
      });
    });

    it('leaves OfferAnswers out when answersBelow is true', () => {
      let component: renderer.ReactTestRenderer;
      act(() => {
        component = renderer.create(
          <NewOrderCell
            order={dummyOrder}
            autoAcceptOrders={false}
            onAccept={jest.fn()}
            onDecline={jest.fn()}
            answersBelow={true}
          />,
        );
      });

      const offerAnswers = component!.root.findAllByType(OfferAnswers);
      expect(offerAnswers).toHaveLength(0);

      act(() => {
        component.unmount();
      });
    });
  });
});
