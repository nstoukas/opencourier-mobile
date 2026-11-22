import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { EarningsDelivery } from './EarningsDelivery';
import { useEarningsDelivery } from '@app/hooks/useEarnings';
import { MainScreens } from '@app/navigation/main/types';
import { EarningsDeliveryDetail } from '@app/types/earnings';

jest.mock('@app/hooks/useEarnings', () => {
  const actual = jest.requireActual('@app/hooks/useEarnings');
  return {
    ...actual,
    useEarningsDelivery: jest.fn(),
  };
});

// Spec 0052 (AC-2): "Make a complaint" button on a job's delivery details in Earnings.
describe('EarningsDelivery Complaint navigation (spec 0052, AC-2)', () => {
  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
    route: { params: { deliveryId: 'del-comp-1' } },
  };

  const sampleDelivery: EarningsDeliveryDetail = {
    deliveryId: 'del-comp-1',
    currencyCode: 'EUR',
    pickupName: 'Taverna Volos',
    dropoffArea: 'Center',
    paidKm: 1.8,
    jobs: [
      {
        acceptedAt: '2026-11-20T12:00:00.000Z',
        endedAt: '2026-11-20T12:20:00.000Z',
        endLabel: null,
        minutes: 20,
        pickupWaitSeconds: 60,
      },
    ],
    breakdown: {
      baseFeeCents: 200,
      distanceFeeCents: 100,
      deliveryPayCents: 300,
      tipsCents: 0,
      compensations: [],
      totalCents: 300,
    },
    timeline: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useEarningsDelivery as jest.Mock).mockReturnValue({
      data: sampleDelivery,
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
  });

  it('renders the complaint card with hint and "Make a complaint" button', () => {
    render(<EarningsDelivery {...defaultProps} />);

    expect(
      screen.getByText(i18n.t('translations:complaint_from_delivery_hint')),
    ).toBeTruthy();

    const fileButton = screen.getByText(
      i18n.t('translations:complaint_file'),
    );
    expect(fileButton).toBeTruthy();
  });

  it('navigates to MainScreens.FileComplaint with deliveryId and deliveryLabel when tapped', () => {
    render(<EarningsDelivery {...defaultProps} />);

    const fileButton = screen.getByText(
      i18n.t('translations:complaint_file'),
    );
    fireEvent.press(fileButton);

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      MainScreens.FileComplaint,
      {
        deliveryId: 'del-comp-1',
        deliveryLabel: 'Taverna Volos, 20 Nov',
      },
    );
  });

  it('uses pickupName as deliveryLabel if delivery has no jobs in list', () => {
    (useEarningsDelivery as jest.Mock).mockReturnValue({
      data: {
        ...sampleDelivery,
        jobs: [],
      },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDelivery {...defaultProps} />);

    const fileButton = screen.getByText(
      i18n.t('translations:complaint_file'),
    );
    fireEvent.press(fileButton);

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      MainScreens.FileComplaint,
      {
        deliveryId: 'del-comp-1',
        deliveryLabel: 'Taverna Volos',
      },
    );
  });
});
