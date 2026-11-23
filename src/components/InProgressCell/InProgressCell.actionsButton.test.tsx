import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render, within } from '@testing-library/react-native';
import '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import { InProgressCell } from './InProgressCell';

// Row 138: the job's ⋯ button sits at the right of the current stop's address, on every
// step of the job. The card only takes it as a ready made piece (`actionsButton`).
describe('InProgressCell actions button slot (row 138)', () => {
  const NOW = 1_800_000_000_000;

  const baseOrder: Order = {
    id: 'c3924f7e-98b3-4f9e-a89a-0123456789ab',
    status: OrderStatus.dispatched,
    pickupBusinessName: 'Souvlaki Bar',
    pickupLocationFormattedAddress: 'Iasonos 12, Volos',
    pickupPhoneNumber: '+302421011111',
    dropoffName: 'Maria Papadopoulou',
    dropoffLocationFormattedAddress: 'Dimitriadis 45, Volos',
    dropoffPhoneNumber: '+306912345678',
    dropoffFloor: '3',
    dropoffDoorbell: 'Papadopoulou',
    orderItems: [{ name: 'Pita Souvlaki', quantity: 2 }],
  } as unknown as Order;

  const noopProps = {
    onCallRestaurant: jest.fn(),
    onCallCustomer: jest.fn(),
    onTextCustomer: jest.fn(),
    onNavigate: jest.fn(),
    onMovePin: jest.fn(),
  };

  const draw = (order: Order, withButton = true) =>
    render(
      <InProgressCell
        order={order}
        {...noopProps}
        actionsButton={withButton ? <View testID="slot-button" /> : undefined}
      />,
    );

  type Node = ReturnType<ReturnType<typeof draw>['getByTestId']>;

  // The nearest drawn view around a node (React's own wrappers in between are skipped).
  const hostParentOf = (node: Node): Node | null => {
    let parent = node.parent;
    while (parent && typeof parent.type !== 'string') {
      parent = parent.parent;
    }
    return parent;
  };

  // The view the button is drawn in, and that view's own children in the order drawn.
  const rowOf = (view: ReturnType<typeof draw>) => {
    const button = view.getByTestId('slot-button');
    const row = hostParentOf(button);
    if (!row) {
      throw new Error('The button has no parent');
    }
    const children = row.findAll(
      node =>
        node !== row &&
        typeof node.type === 'string' &&
        hostParentOf(node) === row,
    );
    return { button, row, children };
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const PICKUP_STEPS = [
    OrderStatus.accepted,
    OrderStatus.dispatched,
    OrderStatus.courier_arrived_at_pickup_location,
  ];
  const CUSTOMER_STEPS = [
    OrderStatus.picked_up,
    OrderStatus.on_the_way,
    OrderStatus.courier_arrived_at_dropoff_location,
  ];

  it.each(PICKUP_STEPS)(
    'on the way to and at the restaurant (%s) it is drawn once, last in the row of the restaurant and its address',
    status => {
      const view = draw({ ...baseOrder, status });

      expect(view.getAllByTestId('slot-button')).toHaveLength(1);
      const { button, row, children } = rowOf(view);
      expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
      expect(
        within(row).getByText('Souvlaki Bar · Iasonos 12, Volos'),
      ).toBeTruthy();
      // At the right: the last of the two things in the row.
      expect(children).toHaveLength(2);
      expect(children[1]).toBe(button);
    },
  );

  it.each(CUSTOMER_STEPS)(
    'on the way to and at the customer (%s) it is drawn once, last in the row of the customer and the address',
    status => {
      const view = draw({ ...baseOrder, status });

      expect(view.getAllByTestId('slot-button')).toHaveLength(1);
      const { button, row, children } = rowOf(view);
      expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('row');
      expect(within(row).getByTestId('job-customer-name')).toBeTruthy();
      expect(within(row).getByText('Dimitriadis 45, Volos')).toBeTruthy();
      expect(children).toHaveLength(2);
      expect(children[1]).toBe(button);
    },
  );

  it('is there during the free hand back window too, when the customer is still hidden', () => {
    const view = draw({
      ...baseOrder,
      status: OrderStatus.dispatched,
      handBackUntilOnPhone: NOW + 45_000,
    } as unknown as Order);

    expect(view.getAllByTestId('slot-button')).toHaveLength(1);
  });

  it('the words beside it take the room left, so a long address wraps instead of pushing it off', () => {
    for (const status of [OrderStatus.dispatched, OrderStatus.picked_up]) {
      const view = draw({ ...baseOrder, status });
      const { button, children } = rowOf(view);

      const beside = children.filter(child => child !== button);
      expect(beside).toHaveLength(1);
      expect(StyleSheet.flatten(beside[0].props.style).flex).toBe(1);
      view.unmount();
    }
  });

  // Row 138 review: the ⋯ button takes about 60 px from the line, so a long Greek name and
  // address that used to fit in two lines gets a third before it is cut.
  describe('the restaurant line beside the button', () => {
    const longOrder = {
      ...baseOrder,
      pickupBusinessName: 'Παραδοσιακό Ψητοπωλείο Ο Γιώργος και τα Παιδιά του',
      pickupLocationFormattedAddress:
        'Ελευθερίου Βενιζέλου 128 & Κωνσταντά, Βόλος 382 21, Ελλάδα',
    } as unknown as Order;
    const longLine =
      'Παραδοσιακό Ψητοπωλείο Ο Γιώργος και τα Παιδιά του · Ελευθερίου Βενιζέλου 128 & Κωνσταντά, Βόλος 382 21, Ελλάδα';

    it.each(PICKUP_STEPS)(
      'allows three lines for the name and address (%s), and holds all of the words',
      status => {
        const view = draw({ ...longOrder, status });
        const { row } = rowOf(view);

        const line = within(row).getByText(longLine);
        expect(line.props.numberOfLines).toBe(3);
      },
    );

    it('allows the same three lines with no button beside it', () => {
      const view = draw(longOrder, false);
      expect(view.getByText(longLine).props.numberOfLines).toBe(3);
    });

    it.each(CUSTOMER_STEPS)(
      'at the customer (%s) the address beside the button has no line limit at all',
      status => {
        const view = draw({ ...baseOrder, status });
        const { row } = rowOf(view);

        expect(
          within(row).getByText('Dimitriadis 45, Volos').props.numberOfLines,
        ).toBeUndefined();
      },
    );
  });

  it('with no button given, the card draws nothing in its place and keeps the address', () => {
    for (const status of [...PICKUP_STEPS, ...CUSTOMER_STEPS]) {
      const view = draw({ ...baseOrder, status }, false);
      expect(view.queryByTestId('slot-button')).toBeNull();
      expect(view.queryByTestId('job-actions-button')).toBeNull();
      view.unmount();
    }

    const atRestaurant = draw(baseOrder, false);
    expect(
      atRestaurant.getByText('Souvlaki Bar · Iasonos 12, Volos'),
    ).toBeTruthy();
    atRestaurant.unmount();

    const atCustomer = draw(
      { ...baseOrder, status: OrderStatus.picked_up },
      false,
    );
    expect(atCustomer.getByText('Dimitriadis 45, Volos')).toBeTruthy();
  });
});
