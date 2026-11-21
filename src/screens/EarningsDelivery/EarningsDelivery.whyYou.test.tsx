import React from 'react';
import { Text } from 'react-native';
import {
  render,
  screen,
  fireEvent,
  within,
} from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { EarningsDelivery } from './EarningsDelivery';
import { useEarningsDelivery } from '@app/hooks/useEarnings';
import { MainScreens } from '@app/navigation/main/types';
import { EarningsDeliveryDetail, EarningsWhyYou } from '@app/types/earnings';

// Spec 0045 (row 14): the "Why you got this" card on the job's page in Earnings. Rendered the way
// EarningsDelivery.test.tsx renders the screen (the hook mocked, real English strings).

jest.mock('@app/hooks/useEarnings', () => {
  const actual = jest.requireActual('@app/hooks/useEarnings');
  return {
    ...actual,
    useEarningsDelivery: jest.fn(),
  };
});

const NONE = 'No reason was recorded for this job.';

describe('EarningsDelivery: why you got this (spec 0045, AC-2 to AC-4)', () => {
  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
    route: { params: { deliveryId: 'del-123' } },
  };

  // No whyYou here: the shape of an answer saved before the field existed.
  const savedBefore: EarningsDeliveryDetail = {
    deliveryId: 'del-123',
    currencyCode: 'EUR',
    pickupName: 'Souvlaki Bar',
    dropoffArea: 'Dimitriadis',
    paidKm: 2.5,
    jobs: [
      {
        acceptedAt: '2026-11-20T12:00:00.000Z',
        endedAt: '2026-11-20T12:20:00.000Z',
        endLabel: null,
        minutes: 20,
        pickupWaitSeconds: 120,
      },
    ],
    breakdown: {
      baseFeeCents: 200,
      distanceFeeCents: 150,
      deliveryPayCents: 350,
      tipsCents: 100,
      compensations: [],
      totalCents: 450,
    },
    timeline: [
      {
        type: 'ACCEPTED',
        at: '2026-11-20T12:00:00.000Z',
        who: 'YOU',
        anotherRider: false,
      },
    ],
  };

  const fairness: EarningsWhyYou = {
    strategy: 'FAIRNESS',
    kind: 'OFFER',
    values: { roadSeconds: 480, centsPerHour: 940, waitingSeconds: 1320 },
    weights: { roadTime: 50, earnings: 30, waiting: 20 },
    estimated: false,
  };

  const renderWith = (data: EarningsDeliveryDetail) => {
    (useEarningsDelivery as jest.Mock).mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
    render(<EarningsDelivery {...defaultProps} />);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-20T12:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the card with the rider's own figures and the weights from the detail's whyYou", () => {
    renderWith({ ...savedBefore, whyYou: fairness });

    const card = within(screen.getByTestId('earnings-why-you'));
    expect(card.getByText('Why you got this')).toBeTruthy();
    expect(card.getByText('8 min to the restaurant')).toBeTruthy();
    // The co-op's currency, as the pay breakdown writes it.
    expect(card.getByText('€9.40 an hour online today')).toBeTruthy();
    expect(
      card.getByText('Waited 22 min since your last job or going Online'),
    ).toBeTruthy();
    expect(
      card.getByText('The co-op weighs road time 50, earnings 30, waiting 20'),
    ).toBeTruthy();
    expect(card.queryByText(NONE)).toBeNull();
  });

  it('shows what an admin given job says', () => {
    renderWith({
      ...savedBefore,
      whyYou: {
        strategy: 'ADMIN',
        kind: 'OFFER',
        values: {},
        weights: {},
        estimated: false,
      },
    });

    const card = within(screen.getByTestId('earnings-why-you'));
    expect(card.getByText('Dispatch gave you this job')).toBeTruthy();
  });

  it('puts the card under the pay breakdown and above the job details', () => {
    renderWith({ ...savedBefore, whyYou: fairness });

    // Every piece of text on the page, in the order it is drawn.
    const texts = screen
      .UNSAFE_getAllByType(Text)
      .map(node => [node.props.children].flat().join(''));
    const breakdownEnd = texts.lastIndexOf('€4.50');
    const card = texts.indexOf('Why you got this');
    const details = texts.indexOf(i18n.t('translations:picked_up_from'));
    expect(breakdownEnd).toBeGreaterThan(-1);
    expect(details).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(breakdownEnd);
    expect(card).toBeLessThan(details);
  });

  it('shows the fallback line when whyYou is missing (an answer saved before the field existed)', () => {
    expect('whyYou' in savedBefore).toBe(false);
    renderWith(savedBefore);

    const card = within(screen.getByTestId('earnings-why-you'));
    expect(card.getByText('Why you got this')).toBeTruthy();
    expect(card.getByText(NONE)).toBeTruthy();
  });

  it('shows the fallback line when whyYou is null', () => {
    renderWith({ ...savedBefore, whyYou: null });

    const card = within(screen.getByTestId('earnings-why-you'));
    expect(card.getByText('Why you got this')).toBeTruthy();
    expect(card.getByText(NONE)).toBeTruthy();
  });

  it('its link opens How offers and pay work', () => {
    renderWith({ ...savedBefore, whyYou: fairness });

    const card = within(screen.getByTestId('earnings-why-you'));
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    fireEvent.press(card.getByText('How offers and pay work'));

    expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      MainScreens.HowItWorks,
    );
    expect(MainScreens.HowItWorks).toBe('HowItWorks');
  });

  it('the link is there with the fallback too', () => {
    renderWith(savedBefore);

    fireEvent.press(screen.getByTestId('earnings-why-you-how'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      MainScreens.HowItWorks,
    );
  });
});
