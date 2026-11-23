import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import ButtonSwipe from '@app/components/ButtonSwipe/ButtonSwipe';
import { JobFooter } from './JobFooter';

jest.mock('@app/hooks/useOrder', () => () => ({
  imHere: jest.fn().mockResolvedValue(true),
  pickedUp: jest.fn().mockResolvedValue(true),
  delivered: jest.fn().mockResolvedValue(true),
}));

// The footer's notices for a removal request. Which of Request removal and Withdraw is
// offered moved behind the ⋯ button with row 138: see `useJobActions.test.tsx`.
describe('JobFooter removal notices (spec 0035, AC-3, AC-5, AC-7, decision 24.26)', () => {
  let alertSpy: jest.SpyInstance;

  const baseOrder: Order = {
    id: 'del-footer-removal',
    status: OrderStatus.dispatched,
    pickupBusinessName: 'Acropolis Grill',
    handBackUntilOnPhone: Date.now() - 60_000, // past free hand back
    removalRequest: null,
  } as unknown as Order;

  const withRequest = (
    status: 'OPEN' | 'DECLINED',
    decisionNote: string | null = null,
  ): Order => ({
    ...baseOrder,
    removalRequest: {
      id: `req-${status}`,
      status,
      label: 'Breakdown',
      paid: true,
      decisionNote,
      createdAt: '2026-11-09T10:00:00Z',
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('shows no removal notice on a job with no request', () => {
    const { queryByTestId } = render(<JobFooter order={baseOrder} />);

    expect(queryByTestId('job-removal-waiting')).toBeNull();
    expect(queryByTestId('job-removal-declined')).toBeNull();
  });

  describe('an open request (AC-3, AC-5)', () => {
    it('shows the waiting line on one line, and the swipe stays usable', () => {
      const { getByTestId, queryByTestId, UNSAFE_getByType } = render(
        <JobFooter order={withRequest('OPEN')} />,
      );

      expect(getByTestId('job-removal-waiting')).toBeTruthy();
      const line = screen.getByText(i18n.t('translations:removal_waiting'));
      expect(line.props.numberOfLines).toBe(1);
      expect(queryByTestId('job-removal-declined')).toBeNull();

      // The request changes nothing about the job: the swipe is there and enabled.
      const swipe = UNSAFE_getByType(ButtonSwipe);
      expect(swipe.props.title).toBe(i18n.t('translations:swipe_picked_up'));
      expect(swipe.props.enabled).toBe(true);
    });
  });

  describe('a refusal stays until the rider asks again (AC-7, decision 24.26)', () => {
    it("shows dispatch's sentence on one line, keeps the swipe, and a tap reads the whole of it", () => {
      const declinedOrder = withRequest(
        'DECLINED',
        'Mechanic is 2 minutes away, please wait.',
      );

      const { getByTestId, queryByTestId, rerender } = render(
        <JobFooter order={declinedOrder} />,
      );

      const declinedIndicator = getByTestId('job-removal-declined');
      const refusalText = screen.getByText(
        i18n.t('translations:removal_declined_with_note', {
          note: 'Mechanic is 2 minutes away, please wait.',
        }),
      );
      // numberOfLines on the refusal Text is 1 (a prop, not a style)
      expect(refusalText.props.numberOfLines).toBe(1);
      expect(queryByTestId('job-removal-waiting')).toBeNull();

      // On a DECLINED job with a sentence, the main swipe stays
      expect(
        screen.getByText(i18n.t('translations:swipe_picked_up')),
      ).toBeTruthy();

      // Tapping the line opens the whole sentence (decision 24.26)
      fireEvent.press(declinedIndicator);
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:removal_declined_full_title'),
        'Mechanic is 2 minutes away, please wait.',
      );

      // When the rider asks again (the request becomes OPEN), the refusal line is replaced
      rerender(<JobFooter order={withRequest('OPEN')} />);

      expect(queryByTestId('job-removal-declined')).toBeNull();
      expect(getByTestId('job-removal-waiting')).toBeTruthy();
    });

    it('a refusal with no sentence says so on one line, keeps the swipe, and a tap opens nothing', () => {
      const { getByTestId } = render(
        <JobFooter order={withRequest('DECLINED', null)} />,
      );

      const declinedIndicator = getByTestId('job-removal-declined');
      const refusalText = screen.getByText(
        i18n.t('translations:removal_declined'),
      );
      expect(refusalText.props.numberOfLines).toBe(1);

      expect(
        screen.getByText(i18n.t('translations:swipe_picked_up')),
      ).toBeTruthy();

      fireEvent.press(declinedIndicator);
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });
});
