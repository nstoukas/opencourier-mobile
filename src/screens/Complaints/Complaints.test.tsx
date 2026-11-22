import React from 'react';
import { Alert, RefreshControl } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { Complaints } from './Complaints';
import { useComplaints, useReplyToComplaint } from '@app/hooks/useComplaints';
import { clearComplaintNotice } from '@app/services/complaintNotice';
import { Complaint } from '@app/types/types';

jest.mock('@app/hooks/useComplaints', () => ({
  useComplaints: jest.fn(),
  useReplyToComplaint: jest.fn(),
}));

jest.mock('@app/services/complaintNotice', () => ({
  clearComplaintNotice: jest.fn(),
}));

// Spec 0052 (AC-4, AC-5, AC-7): Complaints screen tests.
describe('Complaints screen (spec 0052, AC-4, AC-5, AC-7)', () => {
  let mockRefetch: jest.Mock;
  let mockFetchNextPage: jest.Mock;
  let mockReplyMutate: jest.Mock;
  let alertSpy: jest.SpyInstance;
  let focusListener: (() => void) | undefined;

  const mockNavigation: any = {
    toggleDrawer: jest.fn(),
    addListener: jest.fn((event: string, callback: () => void) => {
      if (event === 'focus') {
        focusListener = callback;
      }
      return jest.fn();
    }),
  };

  const sampleComplaintAboutYou: Complaint = {
    id: 'comp-about-1',
    role: 'ABOUT_YOU',
    delivery: {
      id: 'del-1',
      pickupName: 'Pizza Bistro',
      createdAt: '2026-11-20T10:00:00.000Z',
    },
    filedBy: 'RESTAURANT',
    about: 'RIDER',
    category: 'LATE',
    text: 'Courier arrived 40 minutes late.',
    hasPhoto: false,
    status: 'AWAITING_REPLY',
    createdAt: '2026-11-20T11:00:00.000Z',
    riderReply: null,
    repliedAt: null,
    replyEnteredForRider: false,
    outcome: null,
    decidedAt: null,
    withdrawnReason: null,
    withdrawnAt: null,
  };

  const sampleComplaintFiledByYou: Complaint = {
    id: 'comp-filed-1',
    role: 'FILED_BY_YOU',
    delivery: {
      id: 'del-2',
      pickupName: 'Souvlaki Station',
      createdAt: '2026-11-19T14:00:00.000Z',
    },
    filedBy: 'RIDER',
    about: 'CUSTOMER',
    category: 'ABUSE_OR_THREAT',
    text: 'Customer threatened me at the door.',
    hasPhoto: true,
    status: 'OPEN',
    createdAt: '2026-11-19T15:00:00.000Z',
    riderReply: null,
    repliedAt: null,
    replyEnteredForRider: false,
    outcome: null,
    decidedAt: null,
    withdrawnReason: null,
    withdrawnAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert');
    mockRefetch = jest.fn().mockResolvedValue(undefined);
    mockFetchNextPage = jest.fn().mockResolvedValue(undefined);
    mockReplyMutate = jest.fn();

    (useComplaints as jest.Mock).mockReturnValue({
      data: {
        pages: [{ data: [sampleComplaintAboutYou, sampleComplaintFiledByYou] }],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      refetch: mockRefetch,
      fetchNextPage: mockFetchNextPage,
    });

    (useReplyToComplaint as jest.Mock).mockReturnValue({
      mutate: mockReplyMutate,
      isPending: false,
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  describe('Focus and header navigation', () => {
    it('tapping back button calls navigation.toggleDrawer', () => {
      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      const backNav = screen.getByTestId(
        'phosphor-react-native-arrow-left-bold',
      );
      fireEvent.press(backNav);

      expect(mockNavigation.toggleDrawer).toHaveBeenCalledTimes(1);
    });

    it('clears complaint notice in shade and refetches list on screen focus', () => {
      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(mockNavigation.addListener).toHaveBeenCalledWith(
        'focus',
        expect.any(Function),
      );

      // Trigger focus listener
      act(() => {
        focusListener?.();
      });

      expect(clearComplaintNotice).toHaveBeenCalledTimes(1);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('pull to refresh invokes refetch', async () => {
      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      const refreshControl = screen.UNSAFE_getByType(RefreshControl);
      expect(refreshControl).toBeTruthy();

      await act(async () => {
        refreshControl.props.onRefresh();
      });

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Card rendering and kicker (AC-4, AC-7)', () => {
    it('renders complaint about rider from restaurant with correct kicker, category, job, and full words', () => {
      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      // Kicker: from restaurant
      expect(
        screen.getByText(
          i18n.t('translations:complaint_about_you_restaurant'),
        ),
      ).toBeTruthy();

      // Category
      expect(
        screen.getByText(i18n.t('translations:complaint_category_LATE')),
      ).toBeTruthy();

      // Restaurant name and Athens day
      expect(
        screen.getByText(
          i18n.t('translations:complaint_job_line', {
            restaurant: 'Pizza Bistro',
            day: '20 Nov',
          }),
        ),
      ).toBeTruthy();

      // Full words of the complaint (AC-4)
      expect(
        screen.getByText('Courier arrived 40 minutes late.'),
      ).toBeTruthy();
    });

    it('renders complaint about rider from co-op with coop kicker and never an admin name (AC-4)', () => {
      const adminComplaint: Complaint = {
        ...sampleComplaintAboutYou,
        id: 'comp-admin-1',
        filedBy: 'ADMIN',
      };

      (useComplaints as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [adminComplaint] }] },
        isLoading: false,
        isError: false,
        hasNextPage: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.getByText(i18n.t('translations:complaint_about_you_coop')),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          i18n.t('translations:complaint_about_you_restaurant'),
        ),
      ).toBeNull();
    });

    it('renders rider complaint about customer with yours_customer kicker', () => {
      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.getByText(i18n.t('translations:complaint_yours_customer')),
      ).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:complaint_category_ABUSE_OR_THREAT'),
        ),
      ).toBeTruthy();
      expect(
        screen.getByText('Customer threatened me at the door.'),
      ).toBeTruthy();
    });

    it('renders rider complaint about restaurant with yours_restaurant kicker', () => {
      const restaurantComplaint: Complaint = {
        ...sampleComplaintFiledByYou,
        id: 'comp-rest-1',
        about: 'RESTAURANT',
        category: 'RUDE_STAFF',
      };

      (useComplaints as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [restaurantComplaint] }] },
        isLoading: false,
        isError: false,
        hasNextPage: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.getByText(i18n.t('translations:complaint_yours_restaurant')),
      ).toBeTruthy();
    });

    it('falls back to "Something else" (OTHER) for unknown category', () => {
      const unknownCategoryComplaint: Complaint = {
        ...sampleComplaintFiledByYou,
        id: 'comp-unknown-cat',
        category: 'SOME_NEW_FUTURE_CATEGORY' as any,
      };

      (useComplaints as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [unknownCategoryComplaint] }] },
        isLoading: false,
        isError: false,
        hasNextPage: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.getByText(i18n.t('translations:complaint_category_OTHER')),
      ).toBeTruthy();
    });

    it('shows "Photo attached" note when hasPhoto is true, and does not show it when false (AC-9)', () => {
      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      // sampleComplaintFiledByYou hasPhoto: true
      expect(
        screen.getByText(i18n.t('translations:complaint_photo_attached')),
      ).toBeTruthy();

      // When hasPhoto is false for all complaints
      (useComplaints as jest.Mock).mockReturnValue({
        data: {
          pages: [
            { data: [{ ...sampleComplaintFiledByYou, hasPhoto: false }] },
          ],
        },
        isLoading: false,
        isError: false,
        hasNextPage: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      const { rerender } = render(
        <Complaints navigation={mockNavigation} route={{} as any} />,
      );
      rerender(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.queryByText(i18n.t('translations:complaint_photo_attached')),
      ).toBeNull();
    });
  });

  describe('Reply box on AWAITING_REPLY complaint (AC-4, AC-5)', () => {
    it('shows needs reply notice and reply box when status is AWAITING_REPLY for complaint about rider', () => {
      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.getByText(i18n.t('translations:complaint_needs_reply')),
      ).toBeTruthy();

      const replyInput = screen.getByTestId('complaint-reply-comp-about-1');
      expect(replyInput).toBeTruthy();
      expect(replyInput.props.maxLength).toBe(1000);
      expect(screen.getByText('0/1000')).toBeTruthy();

      const sendButton = screen.getByText(
        i18n.t('translations:complaint_reply_send'),
      );
      expect(sendButton).toBeTruthy();
    });

    it('does NOT show reply box for complaints filed by the rider, even if AWAITING_REPLY', () => {
      const filedByYouAwaiting: Complaint = {
        ...sampleComplaintFiledByYou,
        status: 'AWAITING_REPLY',
      };

      (useComplaints as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [filedByYouAwaiting] }] },
        isLoading: false,
        isError: false,
        hasNextPage: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.queryByText(i18n.t('translations:complaint_needs_reply')),
      ).toBeNull();
      expect(
        screen.queryByTestId('complaint-reply-comp-filed-1'),
      ).toBeNull();
    });

    it('confirms before sending reply and triggers reply mutation with trimmed text', () => {
      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      const replyInput = screen.getByTestId('complaint-reply-comp-about-1');
      fireEvent.changeText(replyInput, '   Traffic was heavy due to rain.   ');

      expect(screen.getByText('36/1000')).toBeTruthy();

      const sendButton = screen.getByText(
        i18n.t('translations:complaint_reply_send'),
      );
      fireEvent.press(sendButton);

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:complaint_reply_confirm_title'),
        i18n.t('translations:complaint_reply_confirm_body'),
        expect.any(Array),
      );

      const buttons = alertSpy.mock.calls[0][2];
      const sendAction = buttons.find(
        (b: any) => b.text === i18n.t('translations:complaint_reply_send'),
      );
      expect(sendAction).toBeDefined();

      act(() => {
        sendAction.onPress();
      });

      expect(mockReplyMutate).toHaveBeenCalledWith({
        id: 'comp-about-1',
        text: 'Traffic was heavy due to rain.',
      });
    });

    it('cancelling the confirmation dialog does not call reply mutation', () => {
      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      const replyInput = screen.getByTestId('complaint-reply-comp-about-1');
      fireEvent.changeText(replyInput, 'My response');

      const sendButton = screen.getByText(
        i18n.t('translations:complaint_reply_send'),
      );
      fireEvent.press(sendButton);

      const buttons = alertSpy.mock.calls[0][2];
      const cancelAction = buttons.find(
        (b: any) => b.text === i18n.t('translations:cancel'),
      );
      expect(cancelAction).toBeDefined();

      act(() => {
        cancelAction.onPress?.();
      });

      expect(mockReplyMutate).not.toHaveBeenCalled();
    });
  });

  describe('Statuses: OPEN, DECIDED, WITHDRAWN and existing replies (AC-5, AC-7)', () => {
    it('shows rider reply and indicates when entered by co-op from phone call (83.3)', () => {
      const complaintWithPhoneReply: Complaint = {
        ...sampleComplaintAboutYou,
        status: 'OPEN',
        riderReply: 'Rider called in and explained delivery was delayed by flat tire.',
        replyEnteredForRider: true,
      };

      (useComplaints as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [complaintWithPhoneReply] }] },
        isLoading: false,
        isError: false,
        hasNextPage: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.getByText(i18n.t('translations:complaint_your_reply')),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'Rider called in and explained delivery was delayed by flat tire.',
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:complaint_reply_entered_for_you'),
        ),
      ).toBeTruthy();
    });

    it('shows OPEN status text (with co-op, person decides)', () => {
      const openComplaint: Complaint = {
        ...sampleComplaintAboutYou,
        status: 'OPEN',
        riderReply: 'My response text',
        replyEnteredForRider: false,
      };

      (useComplaints as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [openComplaint] }] },
        isLoading: false,
        isError: false,
        hasNextPage: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.getByText(i18n.t('translations:complaint_open_about_you')),
      ).toBeTruthy();
    });

    it('shows DECIDED status with outcome text and decidedAt time in Athens timezone (AC-7)', () => {
      const decidedComplaint: Complaint = {
        ...sampleComplaintAboutYou,
        status: 'DECIDED',
        outcome: 'Co-op concluded the delay was due to roadworks; no fault.',
        decidedAt: '2026-11-21T16:00:00.000Z',
      };

      (useComplaints as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [decidedComplaint] }] },
        isLoading: false,
        isError: false,
        hasNextPage: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.getByText(i18n.t('translations:complaint_outcome')),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'Co-op concluded the delay was due to roadworks; no fault.',
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:complaint_decided_on', {
            when: '21 Nov, 18:00', // Athens is UTC+2
          }),
        ),
      ).toBeTruthy();
    });

    it('shows WITHDRAWN status with "Withdrawn. No finding against you" for complaint about rider', () => {
      const withdrawnComplaint: Complaint = {
        ...sampleComplaintAboutYou,
        status: 'WITHDRAWN',
        withdrawnReason: 'Restaurant realized courier was not at fault.',
        withdrawnAt: '2026-11-21T12:00:00.000Z',
      };

      (useComplaints as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [withdrawnComplaint] }] },
        isLoading: false,
        isError: false,
        hasNextPage: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.getByText(
          i18n.t('translations:complaint_withdrawn_about_you'),
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'Restaurant realized courier was not at fault.',
        ),
      ).toBeTruthy();
    });

    it('shows WITHDRAWN status with "Withdrawn by the co-op" for complaint filed by rider', () => {
      const withdrawnRiderComplaint: Complaint = {
        ...sampleComplaintFiledByYou,
        status: 'WITHDRAWN',
        withdrawnReason: 'Resolved by phone call.',
        withdrawnAt: '2026-11-21T12:00:00.000Z',
      };

      (useComplaints as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [withdrawnRiderComplaint] }] },
        isLoading: false,
        isError: false,
        hasNextPage: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.getByText(i18n.t('translations:complaint_withdrawn')),
      ).toBeTruthy();
    });
  });

  describe('Pagination and empty states', () => {
    it('shows "Show older" button when hasNextPage is true, and clicking fetches next page', () => {
      (useComplaints as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [sampleComplaintAboutYou] }] },
        isLoading: false,
        isError: false,
        hasNextPage: true,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      const showOlderButton = screen.getByText(
        i18n.t('translations:show_older'),
      );
      expect(showOlderButton).toBeTruthy();

      fireEvent.press(showOlderButton);
      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });

    it('shows empty state message when there are no complaints', () => {
      (useComplaints as jest.Mock).mockReturnValue({
        data: { pages: [{ data: [] }] },
        isLoading: false,
        isError: false,
        hasNextPage: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.getByText(i18n.t('translations:complaint_none')),
      ).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:complaint_none_body')),
      ).toBeTruthy();
    });

    it('shows error state message when complaints fail to load', () => {
      (useComplaints as jest.Mock).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
        hasNextPage: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
      });

      render(<Complaints navigation={mockNavigation} route={{} as any} />);

      expect(
        screen.getByText(i18n.t('translations:complaint_list_failed')),
      ).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:earnings_pull_to_retry')),
      ).toBeTruthy();
    });
  });
});
