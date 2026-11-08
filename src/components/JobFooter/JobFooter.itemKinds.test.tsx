import fs from 'fs';
import path from 'path';
import React from 'react';
import { View } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import ButtonSwipe from '@app/components/ButtonSwipe/ButtonSwipe';
import { InProgressCell } from '@app/components/InProgressCell/InProgressCell';
import { resetItemTicksForTests } from '@app/components/JobItemsLine/JobItemsLine';
import { JobFooter } from './JobFooter';

// Spec 0028 (row 103), AC-4: "Ticks work as today, and the swipe never waits on them."
// Drinks and sides marked and left unticked must never hold back the Picked up swipe.
const mockPickedUp = jest.fn();

jest.mock('@app/hooks/useOrder', () => () => ({
  imHere: jest.fn().mockResolvedValue(true),
  pickedUp: (...args: any[]) => mockPickedUp(...args),
  delivered: jest.fn().mockResolvedValue(true),
}));

describe('the Picked up swipe never waits on the checklist (spec 0028)', () => {
  const order: Order = {
    id: 'del-kinds-swipe-1',
    status: OrderStatus.courier_arrived_at_pickup_location,
    pickupBusinessName: 'Souvlaki Bar',
    pickupLocationFormattedAddress: 'Iasonos 12, Volos',
    pickupPhoneNumber: '+302421011111',
    dropoffName: 'Maria Papadopoulou',
    dropoffLocationFormattedAddress: 'Dimitriadis 45, Volos',
    orderItems: [
      { name: 'Souvlaki', quantity: 2 },
      { name: 'Cola', quantity: 2, kind: 'DRINK' },
      { name: 'Fries', quantity: 1, kind: 'SIDE' },
    ],
  } as unknown as Order;

  const noop = {
    onCallRestaurant: jest.fn(),
    onCallCustomer: jest.fn(),
    onTextCustomer: jest.fn(),
    onNavigate: jest.fn(),
    onMovePin: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetItemTicksForTests();
    mockPickedUp.mockResolvedValue(true);
  });

  afterEach(() => {
    resetItemTicksForTests();
  });

  it('with marked items and nothing ticked, the swipe is enabled and records Picked up', async () => {
    const { getByText, UNSAFE_getByType } = render(
      <View>
        <InProgressCell order={order} {...noop} />
        <JobFooter order={order} onReportIssue={jest.fn()} />
      </View>,
    );

    // The marked line is on the card, nothing is ticked.
    expect(getByText('3 items · 2 drinks, 1 side')).toBeTruthy();

    const swipe = UNSAFE_getByType(ButtonSwipe);
    expect(swipe.props.enabled).toBe(true);
    expect(swipe.props.title).toBe(i18n.t('translations:swipe_picked_up'));

    await act(async () => {
      await swipe.props.onSwiped(true);
    });
    expect(mockPickedUp).toHaveBeenCalledTimes(1);
    expect(mockPickedUp).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'del-kinds-swipe-1' }),
    );
  });

  it('with the sheet open and only some items ticked, the swipe still records Picked up', async () => {
    const { getByTestId, UNSAFE_getByType } = render(
      <View>
        <InProgressCell order={order} {...noop} />
        <JobFooter order={order} onReportIssue={jest.fn()} />
      </View>,
    );

    fireEvent.press(getByTestId('job-items-line'));
    fireEvent.press(getByTestId('job-item-0'));

    const swipe = UNSAFE_getByType(ButtonSwipe);
    expect(swipe.props.enabled).toBe(true);
    await act(async () => {
      await swipe.props.onSwiped(true);
    });
    expect(mockPickedUp).toHaveBeenCalledTimes(1);
  });

  it('the footer reads nothing from the checklist (no import of the items line or the kinds)', () => {
    const source = fs.readFileSync(
      path.join(__dirname, 'JobFooter.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(
      /JobItemsLine|itemKinds|kindCounts|itemsDrinksFirst|ticks/,
    );
  });

  it('the items line takes no callback that could reach a swipe (only deliveryId and items)', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'JobItemsLine', 'JobItemsLine.tsx'),
      'utf8',
    );
    expect(source).toMatch(
      /type Props = \{ deliveryId: string; items: OrderItem\[\] \| null \| undefined \};/,
    );
  });
});
