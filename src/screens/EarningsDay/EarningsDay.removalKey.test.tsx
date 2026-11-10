import React from 'react';
import { render } from '@testing-library/react-native';
import '@app/localization/i18n';
import { EarningsDay } from './EarningsDay';
import { useEarningsDay } from '@app/hooks/useEarningsDay';
import { EarningsDelivery } from '@app/types/types';

jest.mock('@app/hooks/useEarningsDay');

describe('EarningsDay list key includes kind (decision 24.27, Behaviour 12)', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
    route: { params: { date: '2026-11-09' } },
  };

  it('renders two rows for the same deliveryId with different kinds without any duplicate key warning', () => {
    const errorSpy = jest.spyOn(console, 'error');

    // One delivery can pay twice in a day: a wait and a removal (spec 0035, decision 24.27)
    const deliveriesWithSameId: EarningsDelivery[] = [
      {
        deliveryId: 'del-double-100',
        pickupBusinessName: 'Volos Grill',
        dropoffAddress: 'Iasonos 10',
        droppedOffAt: '2026-11-09T14:00:00Z',
        compensation: 120,
        tips: 0,
        total: 120,
        kind: 'WAITING',
      },
      {
        deliveryId: 'del-double-100',
        pickupBusinessName: 'Volos Grill',
        dropoffAddress: 'Iasonos 10',
        droppedOffAt: '2026-11-09T14:15:00Z',
        compensation: 250,
        tips: 0,
        total: 250,
        kind: 'REMOVAL_COMPENSATION',
      },
    ];

    (useEarningsDay as jest.Mock).mockReturnValue({
      deliveries: deliveriesWithSameId,
      deliveryCount: 2,
      compensation: 370,
      tips: 0,
      total: 370,
      currency: 'EUR',
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDay {...defaultProps} />);

    // Assert that React did NOT log a duplicate key warning
    const keyWarnings = errorSpy.mock.calls.filter(call =>
      call.some(
        arg =>
          typeof arg === 'string' &&
          (arg.includes('same key') ||
            arg.includes('duplicate key') ||
            arg.includes('identical keys')),
      ),
    );

    expect(keyWarnings).toHaveLength(0);

    errorSpy.mockRestore();
  });

  it('renders two rows with the same deliveryId and the same kind without a duplicate key warning and draws both rows', () => {
    const errorSpy = jest.spyOn(console, 'error');

    // One delivery can pay twice of the same kind in one day (spec 0035, decision 24.52)
    const deliveriesWithSameIdAndKind: EarningsDelivery[] = [
      {
        deliveryId: 'del-repeat-kind-1',
        pickupBusinessName: 'Volos Grill',
        dropoffAddress: 'Iasonos 10',
        droppedOffAt: '2026-11-09T14:00:00Z',
        compensation: 250,
        tips: 0,
        total: 250,
        kind: 'REMOVAL_COMPENSATION',
      },
      {
        deliveryId: 'del-repeat-kind-1',
        pickupBusinessName: 'Volos Grill',
        dropoffAddress: 'Iasonos 10',
        droppedOffAt: '2026-11-09T16:00:00Z',
        compensation: 250,
        tips: 0,
        total: 250,
        kind: 'REMOVAL_COMPENSATION',
      },
    ];

    (useEarningsDay as jest.Mock).mockReturnValue({
      deliveries: deliveriesWithSameIdAndKind,
      deliveryCount: 2,
      compensation: 500,
      tips: 0,
      total: 500,
      currency: 'EUR',
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    const { getAllByText } = render(<EarningsDay {...defaultProps} />);

    // Assert that both rows are drawn
    const drawnRows = getAllByText('Volos Grill');
    expect(drawnRows).toHaveLength(2);

    // Assert that console.error was NOT called with a message about two children with the same key
    const keyWarnings = errorSpy.mock.calls.filter(call =>
      call.some(
        arg =>
          typeof arg === 'string' &&
          (arg.includes('same key') ||
            arg.includes('duplicate key') ||
            arg.includes('identical keys')),
      ),
    );

    expect(keyWarnings).toHaveLength(0);

    errorSpy.mockRestore();
  });
});
