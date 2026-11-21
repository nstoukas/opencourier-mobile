// Spec 0046 (row 10, AC-7): the job card says "Leg 1 of 2" at every step, so the rider
// knows at the door too that a colleague brings the rest.
import React from 'react';
import { render } from '@testing-library/react-native';
import '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import { clearPickedUpTimes } from '@app/services/pickupTimes';
import { InProgressCell } from './InProgressCell';

describe('InProgressCell leg line (spec 0046, AC-7)', () => {
  const job: Order = {
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

  const handlers = {
    onCallRestaurant: jest.fn(),
    onCallCustomer: jest.fn(),
    onTextCustomer: jest.fn(),
    onNavigate: jest.fn(),
    onMovePin: jest.fn(),
  };

  // Every step a rider holds the job at, from the accept to the customer's door.
  const HELD_STEPS = [
    OrderStatus.accepted,
    OrderStatus.dispatched,
    OrderStatus.courier_arrived_at_pickup_location,
    OrderStatus.picked_up,
    OrderStatus.on_the_way,
    OrderStatus.courier_arrived_at_dropoff_location,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    clearPickedUpTimes();
  });

  afterEach(() => {
    clearPickedUpTimes();
  });

  it.each(HELD_STEPS)('shows "Leg 2 of 3" at %s', status => {
    const { getByTestId, unmount } = render(
      <InProgressCell
        order={{ ...job, status, legNumber: 2, legCount: 3 } as Order}
        {...handlers}
      />,
    );

    expect(getByTestId('job-leg').props.children).toBe('Leg 2 of 3');
    unmount();
  });

  it.each(HELD_STEPS)('shows no leg line for a single delivery at %s', status => {
    const { queryByTestId, unmount } = render(
      <InProgressCell
        order={{ ...job, status, legNumber: null, legCount: null } as Order}
        {...handlers}
      />,
    );

    expect(queryByTestId('job-leg')).toBeNull();
    unmount();
  });

  it('shows no leg line from a server that sends no legs', () => {
    const { queryByTestId } = render(<InProgressCell order={job} {...handlers} />);

    expect(queryByTestId('job-leg')).toBeNull();
  });
});
