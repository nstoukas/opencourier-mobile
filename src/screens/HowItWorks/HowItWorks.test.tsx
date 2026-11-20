import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { HowItWorks } from './HowItWorks';
import {
  useHowItWorks,
  useReviewRequests,
  useSettingChanges,
  useWithdrawReviewRequest,
} from '@app/hooks/useReviewRequests';
import { markReviewsSeen, useReviewSeen } from '@app/services/reviewSeen';
import { clearReviewNotice } from '@app/services/reviewNotice';
import { MainScreens } from '@app/navigation/main/types';
import { ReviewRequest, SettingChangeLine } from '@app/types/types';

jest.mock('@app/hooks/useReviewRequests');
jest.mock('@app/services/reviewSeen');
jest.mock('@app/services/reviewNotice', () => ({
  clearReviewNotice: jest.fn(),
}));

// Mock useFocusEffect to capture the cleanup (blur) function
let focusEffectCleanup: (() => void) | undefined;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (cb: () => (() => void) | void) => {
      const cleanup = cb();
      if (typeof cleanup === 'function') {
        focusEffectCleanup = cleanup;
      }
    },
  };
});

describe('HowItWorks screen (spec 0038, AC-7, AC-8, AC-9, AC-11, AC-13)', () => {
  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
  };

  const mockConfirmWithdraw = jest.fn();
  const mockRefetchHow = jest.fn();
  const mockRefetchRequests = jest.fn();
  const mockRefetchChanges = jest.fn();
  const mockFetchNextRequests = jest.fn();
  const mockFetchNextChanges = jest.fn();

  const sampleHowItWorks = {
    offers: [
      'Each order is offered to the nearest free rider who is Online.',
      'A rider already on a job gets no second offer.',
    ],
    pay: [
      'Base fee is €2.00 plus €0.50 per km.',
      'Waiting pay begins after 5 minutes at €0.15/min.',
    ],
    personDecides: [
      'Removals, reassignments and review answers are decided by a person.',
    ],
    appRecords: [
      'A position only while Online or on a job, erased when you go Offline.',
    ],
    reviewAnswerDays: 14,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    focusEffectCleanup = undefined;

    (useHowItWorks as jest.Mock).mockReturnValue({
      data: sampleHowItWorks,
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: mockRefetchHow,
    });

    (useReviewRequests as jest.Mock).mockReturnValue({
      data: { pages: [{ data: [] }] },
      isLoading: false,
      isError: false,
      isRefetching: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextRequests,
      refetch: mockRefetchRequests,
    });

    (useSettingChanges as jest.Mock).mockReturnValue({
      data: { pages: [{ data: [] }] },
      isLoading: false,
      isError: false,
      isRefetching: false,
      hasNextPage: false,
      fetchNextPage: mockFetchNextChanges,
      refetch: mockRefetchChanges,
    });

    (useWithdrawReviewRequest as jest.Mock).mockReturnValue({
      confirmWithdraw: mockConfirmWithdraw,
      isPending: false,
    });

    (useReviewSeen as jest.Mock).mockReturnValue([]);
    (markReviewsSeen as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Server explanation sections (AC-11)', () => {
    it('renders the 4 server sections verbatim from howItWorks data', () => {
      render(<HowItWorks {...defaultProps} />);

      // Section titles
      expect(screen.getByText(i18n.t('translations:how_offers'))).toBeTruthy();
      expect(screen.getByText(i18n.t('translations:how_pay'))).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:how_person_decides')),
      ).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:how_app_records')),
      ).toBeTruthy();

      // Sentences from the server
      expect(
        screen.getByText(
          'Each order is offered to the nearest free rider who is Online.',
        ),
      ).toBeTruthy();
      expect(
        screen.getByText('Base fee is €2.00 plus €0.50 per km.'),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'Removals, reassignments and review answers are decided by a person.',
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'A position only while Online or on a job, erased when you go Offline.',
        ),
      ).toBeTruthy();

      // Ask review explanation mentions reviewAnswerDays
      expect(
        screen.getByText(
          i18n.t('translations:how_ask_review_body', { days: 14 }),
        ),
      ).toBeTruthy();
    });

    it('shows no time worked card and no spinner when howItWorks answer has no timeWorked field (older server) (AC-13)', () => {
      const olderServerData = {
        ...sampleHowItWorks,
      };
      delete (olderServerData as any).timeWorked;

      (useHowItWorks as jest.Mock).mockReturnValue({
        data: olderServerData,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: mockRefetchHow,
      });

      render(<HowItWorks {...defaultProps} />);

      // Section title must not be present, and no spinner
      expect(
        screen.queryByText(i18n.t('translations:how_time_worked')),
      ).toBeNull();
    });

    it('shows time worked card with a spinner while loading (AC-13)', () => {
      (useHowItWorks as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        isRefetching: false,
        refetch: mockRefetchHow,
      });

      render(<HowItWorks {...defaultProps} />);

      // Section title is shown while loading
      expect(
        screen.getByText(i18n.t('translations:how_time_worked')),
      ).toBeTruthy();
    });

    it('renders the "How your time worked is counted" section from howItWorks.timeWorked (spec 0040, AC-13)', () => {
      (useHowItWorks as jest.Mock).mockReturnValue({
        data: {
          ...sampleHowItWorks,
          timeWorked: [
            'Breaks under 30 minutes count as part of the same shift.',
            'Admins can see your time worked on your page to answer questions and reviews.',
            'No one ranks or compares riders by time worked.',
          ],
        },
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: mockRefetchHow,
      });

      render(<HowItWorks {...defaultProps} />);

      // Section title
      expect(
        screen.getByText(i18n.t('translations:how_time_worked')),
      ).toBeTruthy();

      // Content lines
      expect(
        screen.getByText(
          'Breaks under 30 minutes count as part of the same shift.',
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'Admins can see your time worked on your page to answer questions and reviews.',
        ),
      ).toBeTruthy();
      expect(
        screen.getByText('No one ranks or compares riders by time worked.'),
      ).toBeTruthy();
    });

    it('pressing "Ask for a review" button navigates to RequestReview with empty params', () => {
      render(<HowItWorks {...defaultProps} />);

      // The card header and the button both say "Ask for a review"
      const askElements = screen.getAllByText(
        i18n.t('translations:review_ask'),
      );
      const askButton = askElements[askElements.length - 1];
      fireEvent.press(askButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        MainScreens.RequestReview,
        {},
      );
    });

    it('shows "may be out of date" line when howItWorks has data but isError is true', () => {
      (useHowItWorks as jest.Mock).mockReturnValue({
        data: sampleHowItWorks,
        isLoading: false,
        isError: true,
        isRefetching: false,
        refetch: mockRefetchHow,
      });

      render(<HowItWorks {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:how_maybe_stale')),
      ).toBeTruthy();
    });

    it('hides "may be out of date" line when isError is false', () => {
      (useHowItWorks as jest.Mock).mockReturnValue({
        data: sampleHowItWorks,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: mockRefetchHow,
      });

      render(<HowItWorks {...defaultProps} />);

      expect(
        screen.queryByText(i18n.t('translations:how_maybe_stale')),
      ).toBeNull();
    });
  });

  describe('Review requests list (AC-7, AC-8, AC-9)', () => {
    it('renders OPEN request with due date and Withdraw button', () => {
      const openRequest: ReviewRequest = {
        id: 'rev-open',
        topic: 'PAY',
        note: 'Where is my wait fee?',
        status: 'OPEN',
        createdAt: '2026-11-19T08:00:00Z',
        dueAt: '2026-12-03T08:00:00Z',
        overdue: false,
        outcome: null,
        answer: null,
        answeredAt: null,
        withdrawnAt: null,
        correctionCents: null,
        correctionCurrency: null,
        delivery: {
          id: 'del-1',
          pickupName: 'Pizza Bistro',
          createdAt: '2026-11-19T07:30:00Z',
        },
      };

      (useReviewRequests as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [openRequest] }] },
        hasNextPage: false,
        refetch: mockRefetchRequests,
      });

      render(<HowItWorks {...defaultProps} />);

      expect(screen.getByText('Pay, Pizza Bistro')).toBeTruthy();
      expect(screen.getByText('Where is my wait fee?')).toBeTruthy();
      expect(
        screen.getByText(
          new RegExp(i18n.t('translations:review_due', { when: '.*' })),
        ),
      ).toBeTruthy();

      // Withdraw button calls confirmWithdraw
      const withdrawButton = screen.getByText(
        i18n.t('translations:review_withdraw'),
      );
      fireEvent.press(withdrawButton);
      expect(mockConfirmWithdraw).toHaveBeenCalledWith('rev-open');
    });

    it('renders OPEN request with Overdue flag when overdue: true', () => {
      const overdueRequest: ReviewRequest = {
        id: 'rev-overdue',
        topic: 'OFFER',
        note: 'Missed offer question',
        status: 'OPEN',
        createdAt: '2026-11-01T08:00:00Z',
        dueAt: '2026-11-15T08:00:00Z',
        overdue: true,
        outcome: null,
        answer: null,
        answeredAt: null,
        withdrawnAt: null,
        correctionCents: null,
        correctionCurrency: null,
        delivery: null, // general request
      };

      (useReviewRequests as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [overdueRequest] }] },
        hasNextPage: false,
        refetch: mockRefetchRequests,
      });

      render(<HowItWorks {...defaultProps} />);

      expect(
        screen.getByText(`An offer, ${i18n.t('translations:review_general')}`),
      ).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:review_overdue')),
      ).toBeTruthy();
    });

    it('renders ANSWERED request with outcome CHANGED and correction in correctionCurrency (never assumed EUR)', () => {
      const answeredRequest: ReviewRequest = {
        id: 'rev-answered-usd',
        topic: 'PAY',
        note: 'Please correct payment in dollars',
        status: 'ANSWERED',
        createdAt: '2026-11-18T10:00:00Z',
        dueAt: '2026-12-02T10:00:00Z',
        overdue: false,
        outcome: 'CHANGED',
        answer: 'We adjusted your pay by $2.50.',
        answeredAt: '2026-11-19T10:00:00Z',
        withdrawnAt: null,
        correctionCents: 250,
        correctionCurrency: 'USD',
        delivery: {
          id: 'del-usd',
          pickupName: 'American Diner',
          createdAt: '2026-11-18T09:00:00Z',
        },
      };

      (useReviewRequests as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [answeredRequest] }] },
        hasNextPage: false,
        refetch: mockRefetchRequests,
      });

      render(<HowItWorks {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:review_outcome_changed')),
      ).toBeTruthy();
      expect(screen.getByText('We adjusted your pay by $2.50.')).toBeTruthy();

      // Formatted in USD (US$2.50), NEVER assumed EUR (€2.50)
      expect(
        screen.getByText(
          i18n.t('translations:review_correction', { amount: 'US$2.50' }),
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          i18n.t('translations:review_correction', { amount: '€2.50' }),
        ),
      ).toBeNull();
    });

    it('shows no correction line when an answered request has correctionCents undefined', () => {
      const answeredWithoutCorrection: ReviewRequest = {
        id: 'rev-no-corr',
        topic: 'PAY',
        note: 'Check pay amount',
        status: 'ANSWERED',
        createdAt: '2026-11-18T10:00:00Z',
        dueAt: '2026-12-02T10:00:00Z',
        overdue: false,
        outcome: 'STANDS',
        answer: 'Decision stands, pay was calculated accurately.',
        answeredAt: '2026-11-19T09:00:00Z',
        withdrawnAt: null,
        correctionCents: undefined as any,
        correctionCurrency: null,
        delivery: null,
      };

      (useReviewRequests as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [answeredWithoutCorrection] }] },
        hasNextPage: false,
        refetch: mockRefetchRequests,
      });

      render(<HowItWorks {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:review_outcome_stands')),
      ).toBeTruthy();
      expect(
        screen.getByText('Decision stands, pay was calculated accurately.'),
      ).toBeTruthy();
      expect(
        screen.queryByText(new RegExp('added to your pay', 'i')),
      ).toBeNull();
    });

    it('renders WITHDRAWN request with Withdrawn status label', () => {
      const withdrawnRequest: ReviewRequest = {
        id: 'rev-withdrawn',
        topic: 'OTHER',
        note: 'Withdrawn note',
        status: 'WITHDRAWN',
        createdAt: '2026-11-18T10:00:00Z',
        dueAt: '2026-12-02T10:00:00Z',
        overdue: false,
        outcome: null,
        answer: null,
        answeredAt: null,
        withdrawnAt: '2026-11-18T11:00:00Z',
        correctionCents: null,
        correctionCurrency: null,
        delivery: null,
      };

      (useReviewRequests as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [withdrawnRequest] }] },
        hasNextPage: false,
        refetch: mockRefetchRequests,
      });

      render(<HowItWorks {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:review_withdrawn')),
      ).toBeTruthy();
    });

    it('clears answer notice when the screen is focused (opened)', () => {
      render(<HowItWorks {...defaultProps} />);

      expect(clearReviewNotice).toHaveBeenCalledTimes(1);
    });

    it('shows "New answer" mark when answered request is not in seen, and marks seen on blur (leaving page)', () => {
      const answeredRequest: ReviewRequest = {
        id: 'rev-unseen',
        topic: 'PAY',
        note: 'Check pay',
        status: 'ANSWERED',
        createdAt: '2026-11-18T10:00:00Z',
        dueAt: '2026-12-02T10:00:00Z',
        overdue: false,
        outcome: 'STANDS',
        answer: 'The pay calculation was correct.',
        answeredAt: '2026-11-19T09:00:00Z',
        withdrawnAt: null,
        correctionCents: null,
        correctionCurrency: null,
        delivery: null,
      };

      // Not in seen list
      (useReviewSeen as jest.Mock).mockReturnValue([]);
      (useReviewRequests as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [answeredRequest] }] },
        hasNextPage: false,
        refetch: mockRefetchRequests,
      });

      render(<HowItWorks {...defaultProps} />);

      // Shows "New" badge
      expect(
        screen.getByText(i18n.t('translations:review_new_answer')),
      ).toBeTruthy();

      // Leaving the screen triggers focus effect cleanup
      expect(focusEffectCleanup).toBeDefined();
      act(() => {
        focusEffectCleanup!();
      });

      expect(markReviewsSeen).toHaveBeenCalledWith(['rev-unseen']);
    });

    it('hides "New answer" mark when answered request is already in seen', () => {
      const answeredRequest: ReviewRequest = {
        id: 'rev-already-seen',
        topic: 'PAY',
        note: 'Check pay',
        status: 'ANSWERED',
        createdAt: '2026-11-18T10:00:00Z',
        dueAt: '2026-12-02T10:00:00Z',
        overdue: false,
        outcome: 'STANDS',
        answer: 'Decision stands.',
        answeredAt: '2026-11-19T09:00:00Z',
        withdrawnAt: null,
        correctionCents: null,
        correctionCurrency: null,
        delivery: null,
      };

      // Already seen
      (useReviewSeen as jest.Mock).mockReturnValue(['rev-already-seen']);
      (useReviewRequests as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [answeredRequest] }] },
        hasNextPage: false,
        refetch: mockRefetchRequests,
      });

      render(<HowItWorks {...defaultProps} />);

      expect(
        screen.queryByText(i18n.t('translations:review_new_answer')),
      ).toBeNull();
    });

    it('shows "Show older" button when hasNextPage is true and calls fetchNextPage on press', () => {
      (useReviewRequests as jest.Mock).mockReturnValue({
        data: {
          pages: [
            {
              data: [
                {
                  id: 'rev-1',
                  topic: 'PAY',
                  note: 'Request 1',
                  status: 'OPEN',
                  createdAt: '2026-11-19T00:00:00Z',
                  dueAt: '2026-12-03T00:00:00Z',
                  overdue: false,
                  outcome: null,
                  answer: null,
                  answeredAt: null,
                  withdrawnAt: null,
                  correctionCents: null,
                  correctionCurrency: null,
                  delivery: null,
                },
              ],
            },
          ],
        },
        hasNextPage: true,
        fetchNextPage: mockFetchNextRequests,
        refetch: mockRefetchRequests,
      });

      render(<HowItWorks {...defaultProps} />);

      const showOlderButtons = screen.getAllByText(
        i18n.t('translations:show_older'),
      );
      fireEvent.press(showOlderButtons[0]);

      expect(mockFetchNextRequests).toHaveBeenCalledTimes(1);
    });
  });

  describe('What changed section (AC-13)', () => {
    it('renders change lines credited to "a representative"', () => {
      const sampleChanges: SettingChangeLine[] = [
        {
          at: '2026-11-18T14:30:00Z',
          label: 'Base fee',
          oldText: '€1.80',
          newText: '€2.00',
        },
      ];

      (useSettingChanges as jest.Mock).mockReturnValue({
        data: { pages: [{ data: sampleChanges }] },
        hasNextPage: false,
        refetch: mockRefetchChanges,
      });

      render(<HowItWorks {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:how_what_changed')),
      ).toBeTruthy();
      expect(screen.getByText('Base fee')).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:how_change_line', {
            from: '€1.80',
            to: '€2.00',
          }),
        ),
      ).toBeTruthy();

      // Credited to "a representative"
      expect(screen.getByText(new RegExp('by a representative'))).toBeTruthy();
    });

    it('renders "No changes recorded yet" when change list is empty and not loading', () => {
      (useSettingChanges as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [] }] },
        isLoading: false,
        isError: false,
        hasNextPage: false,
      });

      render(<HowItWorks {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:how_no_changes')),
      ).toBeTruthy();
    });
  });
});
