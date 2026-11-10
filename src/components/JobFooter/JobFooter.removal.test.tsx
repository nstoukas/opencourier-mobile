import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import { JobFooter } from './JobFooter';

jest.mock('@app/hooks/useOrder', () => () => ({
  imHere: jest.fn().mockResolvedValue(true),
  pickedUp: jest.fn().mockResolvedValue(true),
  delivered: jest.fn().mockResolvedValue(true),
}));

describe('JobFooter removal requests (spec 0035, AC-3, AC-5, AC-7, decision 24.25, decision 24.26)', () => {
  let alertSpy: jest.SpyInstance;

  const baseOrder: Order = {
    id: 'del-footer-removal',
    status: OrderStatus.dispatched,
    pickupBusinessName: 'Acropolis Grill',
    handBackUntilOnPhone: Date.now() - 60_000, // past free hand back
    removalRequest: null,
  } as unknown as Order;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert');
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  describe('Behaviour 4: removalBusy hides both Request removal and Withdraw (decision 24.25)', () => {
    it('draws neither Request removal nor Withdraw while removalBusy is true on an open request', () => {
      const openOrder: Order = {
        ...baseOrder,
        removalRequest: {
          id: 'req-open',
          status: 'OPEN',
          label: 'Breakdown',
          paid: true,
          decisionNote: null,
          createdAt: '2026-11-09T10:00:00Z',
        },
      };

      const { queryByTestId, rerender } = render(
        <JobFooter
          order={openOrder}
          onReportIssue={jest.fn()}
          onRequestRemoval={jest.fn()}
          onWithdrawRemoval={jest.fn()}
          removalBusy={true}
        />,
      );

      // Neither action is drawn
      expect(queryByTestId('job-action-request-removal')).toBeNull();
      expect(queryByTestId('job-action-withdraw-removal')).toBeNull();

      // When removalBusy becomes false, Withdraw is drawn
      rerender(
        <JobFooter
          order={openOrder}
          onReportIssue={jest.fn()}
          onRequestRemoval={jest.fn()}
          onWithdrawRemoval={jest.fn()}
          removalBusy={false}
        />,
      );

      expect(queryByTestId('job-action-withdraw-removal')).toBeTruthy();
      expect(queryByTestId('job-action-request-removal')).toBeNull();
    });

    it('draws neither Request removal nor Withdraw while removalBusy is true on a job with no request', () => {
      const { queryByTestId, rerender } = render(
        <JobFooter
          order={baseOrder}
          onReportIssue={jest.fn()}
          onRequestRemoval={jest.fn()}
          onWithdrawRemoval={jest.fn()}
          removalBusy={true}
        />,
      );

      expect(queryByTestId('job-action-request-removal')).toBeNull();
      expect(queryByTestId('job-action-withdraw-removal')).toBeNull();

      // When removalBusy becomes false, Request removal is drawn
      rerender(
        <JobFooter
          order={baseOrder}
          onReportIssue={jest.fn()}
          onRequestRemoval={jest.fn()}
          onWithdrawRemoval={jest.fn()}
          removalBusy={false}
        />,
      );

      expect(queryByTestId('job-action-request-removal')).toBeTruthy();
      expect(queryByTestId('job-action-withdraw-removal')).toBeNull();
    });
  });

  describe('Behaviour 5: open request shows waiting line and Withdraw while other actions stay (AC-3, AC-5)', () => {
    it('shows waiting line, Withdraw button, and retains swipe and Call dispatch', () => {
      const onWithdrawRemoval = jest.fn();
      const onCallDispatch = jest.fn();

      const openOrder: Order = {
        ...baseOrder,
        removalRequest: {
          id: 'req-open',
          status: 'OPEN',
          label: 'Breakdown',
          paid: true,
          decisionNote: null,
          createdAt: '2026-11-09T10:00:00Z',
        },
      };

      const { getByTestId, queryByTestId } = render(
        <JobFooter
          order={openOrder}
          onReportIssue={jest.fn()}
          onCallDispatch={onCallDispatch}
          onRequestRemoval={jest.fn()}
          onWithdrawRemoval={onWithdrawRemoval}
          removalBusy={false}
        />,
      );

      // Waiting line is shown
      const waitingIndicator = getByTestId('job-removal-waiting');
      expect(waitingIndicator).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:removal_waiting')),
      ).toBeTruthy();

      // Withdraw action is shown and triggers callback on press
      const withdrawButton = getByTestId('job-action-withdraw-removal');
      expect(withdrawButton).toBeTruthy();
      fireEvent.press(withdrawButton);
      expect(onWithdrawRemoval).toHaveBeenCalledWith(openOrder);

      // Request removal action is NOT shown while one is open
      expect(queryByTestId('job-action-request-removal')).toBeNull();

      // Other actions stay on footer: Call dispatch, Report issue, and swipe
      const dispatchButton = getByTestId('job-action-dispatch');
      expect(dispatchButton).toBeTruthy();
      fireEvent.press(dispatchButton);
      expect(onCallDispatch).toHaveBeenCalledTimes(1);

      expect(getByTestId('job-action-report')).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:swipe_picked_up')),
      ).toBeTruthy();
    });
  });

  describe('Behaviour 6: refusal shows sentence until rider asks again (AC-7, decision 24.26)', () => {
    it('shows refusal line with sentence, verifies numberOfLines is 1, retains swipe, shows Alert on tap, and offers Request removal to ask again', () => {
      const onRequestRemoval = jest.fn();

      const declinedOrder: Order = {
        ...baseOrder,
        removalRequest: {
          id: 'req-declined',
          status: 'DECLINED',
          label: 'Breakdown',
          paid: true,
          decisionNote: 'Mechanic is 2 minutes away, please wait.',
          createdAt: '2026-11-09T10:00:00Z',
        },
      };

      const { getByTestId, queryByTestId, rerender } = render(
        <JobFooter
          order={declinedOrder}
          onReportIssue={jest.fn()}
          onRequestRemoval={onRequestRemoval}
          onWithdrawRemoval={jest.fn()}
          removalBusy={false}
        />,
      );

      // Shows declined indicator with truncated / formatted text
      const declinedIndicator = getByTestId('job-removal-declined');
      expect(declinedIndicator).toBeTruthy();
      const refusalText = screen.getByText(
        i18n.t('translations:removal_declined_with_note', {
          note: 'Mechanic is 2 minutes away, please wait.',
        }),
      );
      expect(refusalText).toBeTruthy();
      // numberOfLines on the refusal Text is 1 (a prop, not a style)
      expect(refusalText.props.numberOfLines).toBe(1);

      // On a DECLINED job with a sentence, the main swipe stays
      expect(
        screen.getByText(i18n.t('translations:swipe_picked_up')),
      ).toBeTruthy();

      // Tapping declined indicator opens full alert (decision 24.26)
      fireEvent.press(declinedIndicator);
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:removal_declined_full_title'),
        'Mechanic is 2 minutes away, please wait.',
      );

      // Rider can ask again: Request removal action is visible
      const requestRemovalButton = getByTestId('job-action-request-removal');
      expect(requestRemovalButton).toBeTruthy();
      fireEvent.press(requestRemovalButton);
      expect(onRequestRemoval).toHaveBeenCalledWith(declinedOrder);

      // When the rider asks again (removalRequest becomes OPEN), the refusal line is replaced
      const newOpenOrder: Order = {
        ...baseOrder,
        removalRequest: {
          id: 'req-new-open',
          status: 'OPEN',
          label: 'Breakdown',
          paid: true,
          decisionNote: null,
          createdAt: '2026-11-09T10:05:00Z',
        },
      };

      rerender(
        <JobFooter
          order={newOpenOrder}
          onReportIssue={jest.fn()}
          onRequestRemoval={onRequestRemoval}
          onWithdrawRemoval={jest.fn()}
          removalBusy={false}
        />,
      );

      expect(queryByTestId('job-removal-declined')).toBeNull();
      expect(getByTestId('job-removal-waiting')).toBeTruthy();
    });

    it('a DECLINED job with decisionNote null shows job-removal-declined with removal_declined text, numberOfLines 1, retains swipe, and still offers Request removal', () => {
      const onRequestRemoval = jest.fn();

      const declinedOrderNullNote: Order = {
        ...baseOrder,
        removalRequest: {
          id: 'req-declined-null-note',
          status: 'DECLINED',
          label: 'Breakdown',
          paid: true,
          decisionNote: null,
          createdAt: '2026-11-09T10:00:00Z',
        },
      };

      const { getByTestId } = render(
        <JobFooter
          order={declinedOrderNullNote}
          onReportIssue={jest.fn()}
          onRequestRemoval={onRequestRemoval}
          onWithdrawRemoval={jest.fn()}
          removalBusy={false}
        />,
      );

      // Shows declined indicator even with decisionNote null
      const declinedIndicator = getByTestId('job-removal-declined');
      expect(declinedIndicator).toBeTruthy();

      const refusalText = screen.getByText(
        i18n.t('translations:removal_declined'),
      );
      expect(refusalText).toBeTruthy();
      // numberOfLines on refusal Text is 1
      expect(refusalText.props.numberOfLines).toBe(1);

      // On a DECLINED job with no sentence, the main swipe stays
      expect(
        screen.getByText(i18n.t('translations:swipe_picked_up')),
      ).toBeTruthy();

      // Still offers Request removal
      const requestRemovalButton = getByTestId('job-action-request-removal');
      expect(requestRemovalButton).toBeTruthy();
      fireEvent.press(requestRemovalButton);
      expect(onRequestRemoval).toHaveBeenCalledWith(declinedOrderNullNote);
    });
  });

  describe('canRequestRemoval integration on JobFooter (AC-3)', () => {
    it('Call dispatch is present while Request removal is shown on a held job with no request (AC-3)', () => {
      const onCallDispatch = jest.fn();
      const onRequestRemoval = jest.fn();

      const { getByTestId } = render(
        <JobFooter
          order={baseOrder}
          onReportIssue={jest.fn()}
          onCallDispatch={onCallDispatch}
          onRequestRemoval={onRequestRemoval}
          removalBusy={false}
        />,
      );

      expect(getByTestId('job-action-request-removal')).toBeTruthy();
      const dispatchButton = getByTestId('job-action-dispatch');
      expect(dispatchButton).toBeTruthy();
      fireEvent.press(dispatchButton);
      expect(onCallDispatch).toHaveBeenCalledTimes(1);
    });

    it('hides Request removal on finished jobs', () => {
      const droppedOffOrder: Order = {
        ...baseOrder,
        status: OrderStatus.dropped_off,
      };

      const { queryByTestId } = render(
        <JobFooter
          order={droppedOffOrder}
          onReportIssue={jest.fn()}
          onRequestRemoval={jest.fn()}
        />,
      );

      expect(queryByTestId('job-action-request-removal')).toBeNull();
    });

    it('hides Request removal while free hand back is on offer', () => {
      const handBackOrder: Order = {
        ...baseOrder,
        status: OrderStatus.accepted,
        handBackUntilOnPhone: Date.now() + 60_000,
      };

      const { queryByTestId } = render(
        <JobFooter
          order={handBackOrder}
          onReportIssue={jest.fn()}
          onHandBack={jest.fn()}
          onRequestRemoval={jest.fn()}
        />,
      );

      expect(queryByTestId('job-action-hand-back')).toBeTruthy();
      expect(queryByTestId('job-action-request-removal')).toBeNull();
    });
  });
});
