import React from 'react';
import { cleanup, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import {
  clearJobEditMarks,
  jobEditMarksFor,
  markJobEdited,
} from '@app/services/jobEdits/jobEditMarks';
import { InProgressCell } from './InProgressCell';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Row 164 (AC-1, AC-5): InProgressCell shows JobEditedLine in pickup and dropoff stages,
// only for the marked delivery; never records read/seen (Value 5).
describe('InProgressCell job edited line (row 164, AC-1, AC-5)', () => {
  const deliveryId = 'del-cell-1';

  const order = (status: string, extra: Partial<Order> = {}): Order =>
    ({
      id: deliveryId,
      status,
      pickupBusinessName: 'R73 Kitchen',
      pickupLocationFormattedAddress: 'Iasonos 12, Volos',
      dropoffName: 'Maria Papadopoulou',
      dropoffLocationFormattedAddress: 'Dimitriadis 45, Volos',
      readyAt: '2026-11-25T14:30:00.000Z',
      foodReadyAt: null,
      notes: 'Please buzz 3B',
      ...extra,
    } as unknown as Order);

  const props = {
    onCallRestaurant: jest.fn(),
    onCallCustomer: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    clearJobEditMarks();
    await AsyncStorage.clear();
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    cleanup();
    clearJobEditMarks();
    await i18n.changeLanguage('en');
  });

  it('shows no edited line when no mark exists', () => {
    const screen = render(
      <InProgressCell {...props} order={order(OrderStatus.dispatched)} />,
    );
    expect(screen.queryByTestId('job-edited-line')).toBeNull();
  });

  it.each([
    OrderStatus.accepted,
    OrderStatus.dispatched,
    OrderStatus.courier_arrived_at_pickup_location,
  ])('shows "Restaurant changed: notes, times" in pickup stage (%s)', status => {
    markJobEdited({
      deliveryId,
      restaurantName: 'R73 Kitchen',
      changed: ['NOTES', 'TIMES'],
      editedAt: '2026-11-25T14:00:00.000Z',
    });

    const screen = render(<InProgressCell {...props} order={order(status)} />);
    expect(screen.getByTestId('job-edited-line').props.children).toBe(
      'Restaurant changed: notes, times',
    );
  });

  it.each([
    OrderStatus.picked_up,
    OrderStatus.on_the_way,
    OrderStatus.courier_arrived_at_dropoff_location,
  ])('shows "Restaurant changed: notes, times" in dropoff stage (%s)', status => {
    markJobEdited({
      deliveryId,
      restaurantName: 'R73 Kitchen',
      changed: ['NOTES', 'TIMES'],
      editedAt: '2026-11-25T14:00:00.000Z',
    });

    const screen = render(<InProgressCell {...props} order={order(status)} />);
    expect(screen.getByTestId('job-edited-line').props.children).toBe(
      'Restaurant changed: notes, times',
    );
  });

  it('shows Greek text when language is el', async () => {
    await i18n.changeLanguage('el');

    markJobEdited({
      deliveryId,
      restaurantName: 'R73 Kitchen',
      changed: ['NOTES'],
      editedAt: '2026-11-25T14:00:00.000Z',
    });

    const screen = render(
      <InProgressCell {...props} order={order(OrderStatus.dispatched)} />,
    );
    expect(screen.getByTestId('job-edited-line').props.children).toBe(
      'Αλλαγή από το κατάστημα: σημειώσεις',
    );
  });

  it('only shows for the marked delivery, not another job', () => {
    markJobEdited({
      deliveryId: 'different-delivery-id',
      restaurantName: 'R73 Kitchen',
      changed: ['NOTES', 'TIMES'],
      editedAt: '2026-11-25T14:00:00.000Z',
    });

    const screen = render(
      <InProgressCell {...props} order={order(OrderStatus.dispatched)} />,
    );
    expect(screen.queryByTestId('job-edited-line')).toBeNull();
  });

  it('Value 5: drawing the card writes nothing to AsyncStorage, and the mark stays in memory', async () => {
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem');
    const multiSetSpy = jest.spyOn(AsyncStorage, 'multiSet');

    markJobEdited({
      deliveryId,
      restaurantName: 'R73 Kitchen',
      changed: ['NOTES', 'TIMES'],
      editedAt: '2026-11-25T14:00:00.000Z',
    });

    const screen = render(
      <InProgressCell {...props} order={order(OrderStatus.dispatched)} />,
    );
    expect(screen.getByTestId('job-edited-line')).toBeTruthy();

    // No write to storage occurred
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(multiSetSpy).not.toHaveBeenCalled();

    // Re-rendering or re-querying still shows the mark (it stays in memory, never cleared on view)
    expect(jobEditMarksFor(deliveryId)).toEqual(['NOTES', 'TIMES']);

    setItemSpy.mockRestore();
    multiSetSpy.mockRestore();
  });
});
