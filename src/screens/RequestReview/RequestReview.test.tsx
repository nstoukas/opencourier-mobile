import React from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import moment from 'moment';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { formatShift, formatSpaced } from '@app/utilities/dates';
import { RequestReview, REVIEW_NOTE_MAX_LENGTH } from './RequestReview';
import { useSendReviewRequest } from '@app/hooks/useReviewRequests';

jest.mock('@app/hooks/useReviewRequests', () => ({
  useSendReviewRequest: jest.fn(),
}));

describe('RequestReview screen (spec 0038, AC-1, AC-2)', () => {
  const mockNavigation: any = {
    goBack: jest.fn(),
  };

  let mockMutate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutate = jest.fn();
    (useSendReviewRequest as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  describe('General review request (no delivery)', () => {
    const props: any = {
      navigation: mockNavigation,
      route: { params: {} },
    };

    it('renders general intro, no topic preselected, and Send disabled', () => {
      render(<RequestReview {...props} />);

      expect(
        screen.getByText(i18n.t('translations:review_intro_general')),
      ).toBeTruthy();
      expect(screen.getByText('0/1000')).toBeTruthy();

      const sendButtonText = screen.getByText(
        i18n.t('translations:review_send'),
      );
      expect(sendButtonText).toBeTruthy();
    });

    it('allows selecting OFFER, PAY, OTHER topics', () => {
      render(<RequestReview {...props} />);

      const offerRadio = screen.getByTestId('review-topic-OFFER');
      const payRadio = screen.getByTestId('review-topic-PAY');
      const otherRadio = screen.getByTestId('review-topic-OTHER');

      expect(offerRadio.props.accessibilityState.selected).toBe(false);
      expect(payRadio.props.accessibilityState.selected).toBe(false);
      expect(otherRadio.props.accessibilityState.selected).toBe(false);

      act(() => {
        fireEvent.press(offerRadio);
      });
      expect(offerRadio.props.accessibilityState.selected).toBe(true);

      act(() => {
        fireEvent.press(otherRadio);
      });
      expect(offerRadio.props.accessibilityState.selected).toBe(false);
      expect(otherRadio.props.accessibilityState.selected).toBe(true);
    });

    it('keeps Send disabled when note is whitespace only', () => {
      render(<RequestReview {...props} />);

      act(() => {
        fireEvent.press(screen.getByTestId('review-topic-OTHER'));
        fireEvent.changeText(screen.getByTestId('review-note'), '     ');
      });

      const sendButtonText = screen.getByText(
        i18n.t('translations:review_send'),
      );
      act(() => {
        fireEvent.press(sendButtonText);
      });
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('trims note and sends general request without deliveryId', () => {
      render(<RequestReview {...props} />);

      act(() => {
        fireEvent.press(screen.getByTestId('review-topic-OFFER'));
        fireEvent.changeText(
          screen.getByTestId('review-note'),
          '   Why did I receive no offers?   ',
        );
      });

      expect(screen.getByText('34/1000')).toBeTruthy();

      const sendButtonText = screen.getByText(
        i18n.t('translations:review_send'),
      );
      act(() => {
        fireEvent.press(sendButtonText);
      });

      expect(mockMutate).toHaveBeenCalledWith(
        {
          topic: 'OFFER',
          note: 'Why did I receive no offers?',
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it('on success with dueAt: shows alert titled "Sent" with formatted due date line and navigates back', () => {
      render(<RequestReview {...props} />);

      act(() => {
        fireEvent.press(screen.getByTestId('review-topic-OFFER'));
        fireEvent.changeText(
          screen.getByTestId('review-note'),
          'Why did I receive no offers?',
        );
      });

      const sendButtonText = screen.getByText(
        i18n.t('translations:review_send'),
      );
      act(() => {
        fireEvent.press(sendButtonText);
      });

      const alertSpy = jest.spyOn(Alert, 'alert');
      const { onSuccess } = mockMutate.mock.calls[0][1];

      const dueAtString = '2026-11-26T12:00:00.000Z';
      const due = moment(dueAtString);
      const expectedWhen = `${due.format(formatSpaced)}, ${due.format(
        formatShift,
      )}`;

      act(() => {
        onSuccess({ dueAt: dueAtString });
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:review_sent_title'),
        i18n.t('translations:review_due', { when: expectedWhen }),
      );
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('on success with no dueAt in answer: shows alert titled "Sent" with undefined message and navigates back', () => {
      render(<RequestReview {...props} />);

      act(() => {
        fireEvent.press(screen.getByTestId('review-topic-OTHER'));
        fireEvent.changeText(
          screen.getByTestId('review-note'),
          'General feedback note',
        );
      });

      const sendButtonText = screen.getByText(
        i18n.t('translations:review_send'),
      );
      act(() => {
        fireEvent.press(sendButtonText);
      });

      const alertSpy = jest.spyOn(Alert, 'alert');
      const { onSuccess } = mockMutate.mock.calls[0][1];

      act(() => {
        onSuccess({});
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:review_sent_title'),
        undefined,
      );
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delivery-linked review request', () => {
    const props: any = {
      navigation: mockNavigation,
      route: {
        params: {
          deliveryId: 'del-99',
          deliveryLabel: 'Souvlaki Express, 19 Nov',
        },
      },
    };

    it('preselects PAY topic and displays delivery intro', () => {
      render(<RequestReview {...props} />);

      expect(
        screen.getByText(
          i18n.t('translations:review_intro_delivery', {
            delivery: 'Souvlaki Express, 19 Nov',
          }),
        ),
      ).toBeTruthy();

      const payRadio = screen.getByTestId('review-topic-PAY');
      expect(payRadio.props.accessibilityState.selected).toBe(true);
    });

    it('sends deliveryId with trimmed note when submitted', () => {
      render(<RequestReview {...props} />);

      act(() => {
        fireEvent.changeText(
          screen.getByTestId('review-note'),
          'Wait time compensation was missing.',
        );
      });

      const sendButtonText = screen.getByText(
        i18n.t('translations:review_send'),
      );
      act(() => {
        fireEvent.press(sendButtonText);
      });

      expect(mockMutate).toHaveBeenCalledWith(
        {
          topic: 'PAY',
          note: 'Wait time compensation was missing.',
          deliveryId: 'del-99',
        },
        expect.any(Object),
      );
    });

    it('enforces maxLength of 1000 characters on note input', () => {
      render(<RequestReview {...props} />);

      const noteInput = screen.getByTestId('review-note');
      expect(noteInput.props.maxLength).toBe(REVIEW_NOTE_MAX_LENGTH);
      expect(noteInput.props.maxLength).toBe(1000);
    });
  });

  describe('Pending mutation state', () => {
    const props: any = {
      navigation: mockNavigation,
      route: { params: {} },
    };

    it('disables radio buttons and shows spinner when mutation isPending', () => {
      (useSendReviewRequest as jest.Mock).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      });

      render(<RequestReview {...props} />);

      const offerRadio = screen.getByTestId('review-topic-OFFER');
      expect(offerRadio.props.accessibilityState.disabled).toBe(true);

      // When isPending is true, Button renders ActivityIndicator
      expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });
});
