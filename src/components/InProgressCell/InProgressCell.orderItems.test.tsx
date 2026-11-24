import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import { clearPickedUpTimes } from '@app/services/pickupTimes';
import { resetItemTicksForTests } from '@app/components/JobItemsLine/JobItemsLine';
import { InProgressCell } from './InProgressCell';

// Row 159: test that the job card draws safely when orderItems is null, an object ({}),
// or a mixed list containing malformed items (no crash, no 'NaN', no '02').
describe('InProgressCell orderItems resilience (row 159)', () => {
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
  } as unknown as Order;

  const noopProps = {
    onCallRestaurant: jest.fn(),
    onCallCustomer: jest.fn(),
    onTextCustomer: jest.fn(),
    onNavigate: jest.fn(),
    onMovePin: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    clearPickedUpTimes();
    resetItemTicksForTests();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    clearPickedUpTimes();
    resetItemTicksForTests();
  });

  it('draws without crashing and omits items line when orderItems is null', () => {
    const orderWithNullItems = {
      ...baseOrder,
      orderItems: null,
    } as unknown as Order;

    const { queryByTestId, queryByText } = render(
      <InProgressCell order={orderWithNullItems} {...noopProps} />,
    );

    // Job items line is omitted
    expect(queryByTestId('job-items-line')).toBeNull();
    // No error artefacts
    expect(queryByText(/NaN/)).toBeNull();
    expect(queryByText(/02/)).toBeNull();
  });

  it('draws without crashing and omits items line when orderItems is an empty object {}', () => {
    const orderWithObjectItems = {
      ...baseOrder,
      orderItems: {},
    } as unknown as Order;

    const { queryByTestId, queryByText } = render(
      <InProgressCell order={orderWithObjectItems} {...noopProps} />,
    );

    // Job items line is omitted because {} is not an array
    expect(queryByTestId('job-items-line')).toBeNull();
    // No error artefacts
    expect(queryByText(/NaN/)).toBeNull();
    expect(queryByText(/02/)).toBeNull();
  });

  it('draws without crashing and opens sheet correctly with a mixed list (no crash, no NaN, no 02)', () => {
    const mixedItems = [
      null,
      123,
      'junk-string',
      { price: 15 }, // no name
      { name: '' }, // empty name
      { name: '   ' }, // whitespace name
      { name: 'Pork Gyros', quantity: '2', size: 'Large' },
      { name: 'Cola Zero', quantity: '2', kind: 'DRINK', size: 5 }, // size: 5 must become ''
      { name: 'French Fries', quantity: 'x', kind: 'SIDE' }, // quantity 'x' must become 1
      { name: 'Salad', quantity: -1, kind: 'FOOD' }, // quantity -1 must become 1, 'FOOD' dropped
    ];

    const orderWithMixedItems = {
      ...baseOrder,
      orderItems: mixedItems,
    } as unknown as Order;

    const { getByTestId, queryByText, getByText } = render(
      <InProgressCell order={orderWithMixedItems} {...noopProps} />,
    );

    // Items line should be rendered for the 4 valid items:
    // 4 items, 2 drinks (from Cola Zero quantity '2' -> 2), 1 side (from French Fries quantity 'x' -> 1)
    const itemsLine = getByTestId('job-items-line');
    expect(itemsLine).toBeTruthy();

    // Verify correct counts on the summary line: "4 items · 2 drinks, 1 side"
    // Without normalisation, string addition produces "02 drinks"
    expect(
      within(itemsLine).getByText('4 items · 2 drinks, 1 side'),
    ).toBeTruthy();

    // Ensure no NaN and no 02 are shown
    expect(queryByText(/NaN/)).toBeNull();
    expect(queryByText(/02/)).toBeNull();

    // Open the sheet: previously, size: 5 would cause size.toUpperCase() to throw!
    fireEvent.press(itemsLine);

    expect(getByTestId('job-items-sheet')).toBeTruthy();

    // Drinks and sides are listed first in the sheet:
    // Cola Zero has quantity 2
    expect(getByText('2 × Cola Zero')).toBeTruthy();
    // French Fries has quantity normalised to 1
    expect(getByText('French Fries')).toBeTruthy();
    // Pork Gyros has quantity '2' normalised to 2
    expect(getByText('2 × Pork Gyros')).toBeTruthy();
    // Salad has quantity -1 normalised to 1
    expect(getByText('Salad')).toBeTruthy();

    // Still no NaN and no 02 anywhere in the sheet
    expect(queryByText(/NaN/)).toBeNull();
    expect(queryByText(/02/)).toBeNull();
  });
});
