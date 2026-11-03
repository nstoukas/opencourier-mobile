import React from 'react';
import { render } from '@testing-library/react-native';
import '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import { clearPickedUpTimes } from '@app/services/pickupTimes';
import { InProgressCell } from './InProgressCell';

// Spec 0023 (AC-7): the job card shows the ready line only while heading to
// the restaurant or waiting there, and never after pickup.
describe('InProgressCell ready line (spec 0023, AC-7)', () => {
  const NOW = Date.parse('2026-11-03T12:00:00.000Z');

  const order = (status: string, extra: Partial<Order> = {}): Order =>
    ({
      id: 'c3924f7e-98b3-4f9e-a89a-0123456789ab',
      status,
      pickupBusinessName: 'R73 Kitchen',
      pickupLocationFormattedAddress: 'Iasonos 12, Volos',
      dropoffName: 'Maria Papadopoulou',
      dropoffLocationFormattedAddress: 'Dimitriadis 45, Volos',
      readyAt: '2026-11-03T12:08:00.000Z',
      foodReadyAt: null,
      readyAtOnPhone: NOW + 8 * 60 * 1000,
      ...extra,
    } as unknown as Order);

  const props = {
    onCallRestaurant: jest.fn(),
    onCallCustomer: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    clearPickedUpTimes();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    clearPickedUpTimes();
  });

  it.each([
    OrderStatus.accepted,
    OrderStatus.dispatched,
    OrderStatus.courier_arrived_at_pickup_location,
  ])('shows "Preparing, ~8 min" in the pickup stage (%s)', status => {
    const screen = render(<InProgressCell {...props} order={order(status)} />);
    expect(screen.getByTestId('job-ready-line').props.children).toBe(
      'Preparing, ~8 min',
    );
  });

  it('shows "Ready" in the pickup stage once the food is ready', () => {
    const screen = render(
      <InProgressCell
        {...props}
        order={order(OrderStatus.courier_arrived_at_pickup_location, {
          foodReadyAt: '2026-11-03T11:59:00.000Z',
        })}
      />,
    );
    expect(screen.getByTestId('job-ready-line').props.children).toBe('Ready');
  });

  it.each([
    OrderStatus.picked_up,
    OrderStatus.on_the_way,
    OrderStatus.courier_arrived_at_dropoff_location,
    OrderStatus.dropped_off,
  ])('shows no ready line after pickup (%s)', status => {
    const screen = render(
      <InProgressCell
        {...props}
        order={order(status, { foodReadyAt: '2026-11-03T11:59:00.000Z' })}
      />,
    );
    expect(screen.queryByTestId('job-ready-line')).toBeNull();
    const screen2 = render(<InProgressCell {...props} order={order(status)} />);
    expect(screen2.queryByTestId('job-ready-line')).toBeNull();
  });

  it('shows no ready line for a job made before ready times existed', () => {
    const screen = render(
      <InProgressCell
        {...props}
        order={order(OrderStatus.dispatched, {
          readyAt: null,
          readyAtOnPhone: undefined,
        })}
      />,
    );
    expect(screen.queryByTestId('job-ready-line')).toBeNull();
    // The rest of the pickup card is still there.
    expect(screen.getByTestId('job-order-code')).toBeTruthy();
  });

  it('reads the phone-clock ready time, not the raw server readyAt', () => {
    // The server's readyAt says 8 min; readyAtOnPhone (corrected) says 3 min.
    const screen = render(
      <InProgressCell
        {...props}
        order={order(OrderStatus.dispatched, {
          readyAtOnPhone: NOW + 3 * 60 * 1000,
        })}
      />,
    );
    expect(screen.getByTestId('job-ready-line').props.children).toBe(
      'Preparing, ~3 min',
    );
  });
});
