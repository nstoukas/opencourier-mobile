import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { OrderItem } from '@app/types/types';
import { JobItemsLine, resetItemTicksForTests } from './JobItemsLine';

describe('JobItemsLine (spec 0021, AC-7)', () => {
  const sampleItems: OrderItem[] = [
    { name: 'Cheeseburger', quantity: 2, size: 'Large' },
    { name: 'French Fries', quantity: 1 },
  ] as unknown as OrderItem[];

  beforeEach(() => {
    resetItemTicksForTests();
  });

  afterEach(() => {
    resetItemTicksForTests();
  });

  it('renders null when items is null, undefined, or empty (no items, no row)', () => {
    const { toJSON: toJSONNull } = render(
      <JobItemsLine deliveryId="del-1" items={null} />,
    );
    expect(toJSONNull()).toBeNull();

    const { toJSON: toJSONEmpty } = render(
      <JobItemsLine deliveryId="del-1" items={[]} />,
    );
    expect(toJSONEmpty()).toBeNull();

    const { toJSON: toJSONUndefined } = render(
      <JobItemsLine deliveryId="del-1" items={undefined} />,
    );
    expect(toJSONUndefined()).toBeNull();
  });

  it('renders compact line with items count and opens sheet on press', () => {
    const { getByTestId, getByText, queryByText } = render(
      <JobItemsLine deliveryId="del-1" items={sampleItems} />,
    );

    const line = getByTestId('job-items-line');
    expect(line).toBeTruthy();
    expect(
      getByText(i18n.t('translations:items_count', { count: 2 })),
    ).toBeTruthy();

    fireEvent.press(line);

    expect(getByTestId('job-items-sheet')).toBeTruthy();
    expect(getByText('2 × Cheeseburger')).toBeTruthy();
    // Spec 0028: with more than one line sent, the size is the order's, not the
    // first line's, so the sheet no longer shows it.
    expect(queryByText('Large')).toBeNull();
    expect(getByText('French Fries')).toBeTruthy();
  });

  it('toggles item checkbox state in memory without blocking anything', () => {
    const { getByTestId } = render(
      <JobItemsLine deliveryId="del-1" items={sampleItems} />,
    );

    fireEvent.press(getByTestId('job-items-line'));

    const item0 = getByTestId('job-item-0');
    expect(item0.props.accessibilityState).toEqual({ checked: false });

    // Tick the item
    fireEvent.press(item0);
    expect(getByTestId('job-item-0').props.accessibilityState).toEqual({
      checked: true,
    });

    // Untick the item
    fireEvent.press(getByTestId('job-item-0'));
    expect(getByTestId('job-item-0').props.accessibilityState).toEqual({
      checked: false,
    });
  });

  it('keeps tick state across sheet reopens for the same deliveryId', () => {
    const { getByTestId, rerender } = render(
      <JobItemsLine deliveryId="del-1" items={sampleItems} />,
    );

    fireEvent.press(getByTestId('job-items-line'));
    fireEvent.press(getByTestId('job-item-0'));

    // Re-render
    rerender(<JobItemsLine deliveryId="del-1" items={sampleItems} />);
    fireEvent.press(getByTestId('job-items-line'));

    expect(getByTestId('job-item-0').props.accessibilityState).toEqual({
      checked: true,
    });
  });
});
