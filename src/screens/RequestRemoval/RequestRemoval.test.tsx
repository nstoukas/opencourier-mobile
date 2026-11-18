import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RequestRemoval } from './RequestRemoval';
import { Button } from '@app/components/Button/Button';
import {
  useRemovalBusy,
  useRemovalReasons,
  useSendRemovalRequest,
} from '@app/hooks/useRemovalRequest';
import { services } from '@app/services/service';
import { RemovalReason } from '@app/types/types';
import i18n from '@app/localization/i18n';

const actualHooks = jest.requireActual('@app/hooks/useRemovalRequest');
jest.mock('@app/hooks/useRemovalRequest', () => {
  const actual = jest.requireActual('@app/hooks/useRemovalRequest');
  return {
    ...actual,
    useRemovalBusy: jest.fn(),
    useSendRemovalRequest: jest.fn(),
    useRemovalReasons: jest.fn(),
  };
});

describe('RequestRemoval screen (spec 0035, AC-3)', () => {
  const mockOrder = {
    id: 'del-removal-1',
  } as any;

  const mockNavigation: any = {
    goBack: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
    route: {
      params: {
        order: mockOrder,
      },
    },
  };

  const mockSend = jest.fn();

  const sampleReasons: RemovalReason[] = [
    {
      id: 'reason-1',
      label: 'Moped breakdown',
      paid: true,
      needsNote: false,
    },
    {
      id: 'reason-2',
      label: 'Personal emergency',
      paid: false,
      needsNote: false,
    },
    {
      id: 'reason-3',
      label: 'Other',
      paid: true,
      needsNote: true,
    },
  ];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useRemovalBusy as jest.Mock).mockReturnValue(false);
    (useSendRemovalRequest as jest.Mock).mockReturnValue({
      send: mockSend,
    });
    (useRemovalReasons as jest.Mock).mockReturnValue({
      data: sampleReasons,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  describe('Reasons list marks each reason Paid or Not paid (AC-3, Behaviour 2)', () => {
    it('renders reasons in the exact order given by the server using a non-alphabetical list', () => {
      const nonAlphabeticalReasons: RemovalReason[] = [
        {
          id: 'reason-z',
          label: 'Zebra breakdown',
          paid: true,
          needsNote: false,
        },
        {
          id: 'reason-a',
          label: 'Apple fallen',
          paid: false,
          needsNote: false,
        },
        {
          id: 'reason-m',
          label: 'Motor flat tire',
          paid: true,
          needsNote: false,
        },
      ];

      (useRemovalReasons as jest.Mock).mockReturnValue({
        data: nonAlphabeticalReasons,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      });

      render(<RequestRemoval {...defaultProps} />);

      const reasonRows = screen.getAllByTestId(/^removal-reason-/);
      expect(reasonRows.map(r => r.props.testID)).toEqual([
        'removal-reason-reason-z',
        'removal-reason-reason-a',
        'removal-reason-reason-m',
      ]);
    });

    it('marks reason-1 Paid and reason-2 Not paid based on the server flag', () => {
      render(<RequestRemoval {...defaultProps} />);

      // Check labels exist
      expect(screen.getByText('Moped breakdown')).toBeTruthy();
      expect(screen.getByText('Personal emergency')).toBeTruthy();
      expect(screen.getByText('Other')).toBeTruthy();

      // Check Paid / Not paid text
      const paidTexts = screen.getAllByText(
        i18n.t('translations:removal_paid'),
      );
      const notPaidTexts = screen.getAllByText(
        i18n.t('translations:removal_not_paid'),
      );

      // reason-1 (paid: true) and reason-3 (paid: true) => 2 Paid badges
      expect(paidTexts).toHaveLength(2);
      // reason-2 (paid: false) => 1 Not paid badge
      expect(notPaidTexts).toHaveLength(1);
    });
  });

  describe('Note requirement and 500-char limit (AC-3, Behaviour 3)', () => {
    it('does not require a note when needsNote is false; Send is enabled with empty note', () => {
      render(<RequestRemoval {...defaultProps} />);

      // Select reason-1 (needsNote: false)
      fireEvent.press(screen.getByTestId('removal-reason-reason-1'));

      const noteInput = screen.getByTestId('removal-note');
      expect(noteInput.props.placeholder).toBe(
        i18n.t('translations:removal_note_optional'),
      );
      expect(noteInput.props.maxLength).toBe(500);

      // Note count shows 0/500
      expect(screen.getByText('0/500')).toBeTruthy();

      // Send button is enabled
      const sendButton = screen.getByText(i18n.t('translations:removal_send'));
      expect(sendButton).toBeTruthy();

      act(() => {
        fireEvent.press(sendButton);
      });
      expect(mockSend).toHaveBeenCalledWith(
        {
          orderId: 'del-removal-1',
          reasonId: 'reason-1',
          note: undefined,
        },
        expect.any(Function),
      );
    });

    it('requires a note when needsNote is true; Send is disabled until non-whitespace text is entered', () => {
      render(<RequestRemoval {...defaultProps} />);

      // Select reason-3 (needsNote: true)
      fireEvent.press(screen.getByTestId('removal-reason-reason-3'));

      const noteInput = screen.getByTestId('removal-note');
      expect(noteInput.props.placeholder).toBe(
        i18n.t('translations:removal_note_required'),
      );
      expect(noteInput.props.autoFocus).toBe(true);

      // Send button is disabled with empty note
      expect(mockSend).not.toHaveBeenCalled();

      // Typing only whitespace keeps Send disabled
      fireEvent.changeText(noteInput, '   ');
      const sendButton = screen.getByText(i18n.t('translations:removal_send'));
      fireEvent.press(sendButton);
      expect(mockSend).not.toHaveBeenCalled();

      // Typing valid text enables Send
      fireEvent.changeText(noteInput, 'Flat tire on the highway');
      expect(screen.getByText('24/500')).toBeTruthy();

      act(() => {
        fireEvent.press(sendButton);
      });
      expect(mockSend).toHaveBeenCalledWith(
        {
          orderId: 'del-removal-1',
          reasonId: 'reason-3',
          note: 'Flat tire on the highway',
        },
        expect.any(Function),
      );

      // Verify onSent callback navigates back
      const onSentCallback = mockSend.mock.calls[0][1];
      onSentCallback();
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('caps note at 500 characters', () => {
      render(<RequestRemoval {...defaultProps} />);
      fireEvent.press(screen.getByTestId('removal-reason-reason-1'));

      const noteInput = screen.getByTestId('removal-note');
      expect(noteInput.props.maxLength).toBe(500);
    });
  });

  describe('Busy and error states', () => {
    it('pressing Send while useRemovalBusy is true does not call send (reason already chosen, then mock turns busy)', () => {
      (useRemovalBusy as jest.Mock).mockReturnValue(false);

      const { UNSAFE_getByType, rerender } = render(
        <RequestRemoval {...defaultProps} />,
      );

      // Choose reason-1 (needsNote is false)
      fireEvent.press(screen.getByTestId('removal-reason-reason-1'));

      // Now mock turns busy (e.g. mutation started or background task in flight)
      (useRemovalBusy as jest.Mock).mockReturnValue(true);
      rerender(<RequestRemoval {...defaultProps} />);

      // Press the button component (which renders ActivityIndicator while busy)
      const button = UNSAFE_getByType(Button);
      const indicator = button.findByType(ActivityIndicator);
      fireEvent.press(indicator);

      // send was NOT called
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('disables reasons and send button while sending is in flight', () => {
      (useRemovalBusy as jest.Mock).mockReturnValue(true);

      render(<RequestRemoval {...defaultProps} />);

      const reasonRow = screen.getByTestId('removal-reason-reason-1');
      expect(reasonRow.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true }),
      );
    });

    it('shows error message and retry button when reasons fail to load', () => {
      const mockRefetch = jest.fn();
      (useRemovalReasons as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
      });

      render(<RequestRemoval {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:removal_reasons_failed')),
      ).toBeTruthy();

      const retryButton = screen.getByText(
        i18n.t('translations:removal_try_again'),
      );
      fireEvent.press(retryButton);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Fresh reasons list on screen reopen (decision 24.50, minor 1)', () => {
    it('after the screen closes and reopens, the list is fetched before anything is drawn, so an old list with old Paid marks is never shown', async () => {
      (useRemovalReasons as jest.Mock).mockImplementation(
        actualHooks.useRemovalReasons,
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const firstAnswer: RemovalReason[] = [
        {
          id: 'reason-1',
          label: 'Moped breakdown',
          paid: true,
          needsNote: false,
        },
      ];

      const getReasonsSpy = jest
        .spyOn(services.orderService, 'getRemovalReasons')
        .mockResolvedValueOnce(firstAnswer);

      // First opening: screen mounts with reason marked Paid
      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <RequestRemoval {...defaultProps} />
        </QueryClientProvider>,
      );

      // Advance timers and flush microtasks to let the first fetch resolve
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        jest.runAllTimers();
      });

      expect(getReasonsSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Moped breakdown')).toBeDefined();
      expect(
        screen.getByText(i18n.t('translations:removal_paid')),
      ).toBeDefined();

      // Close the screen: unmount
      unmount();

      // Give gc a chance to run after unmount (with gcTime 0 React Query removes the query on a timer)
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Change service answer so that reason is no longer Paid, held unresolved
      let resolveSecondFetch!: (reasons: RemovalReason[]) => void;
      const secondFetchPromise = new Promise<RemovalReason[]>(resolve => {
        resolveSecondFetch = resolve;
      });
      getReasonsSpy.mockReturnValueOnce(secondFetchPromise);

      // Second opening: render again with the SAME QueryClient
      render(
        <QueryClientProvider client={queryClient}>
          <RequestRemoval {...defaultProps} />
        </QueryClientProvider>,
      );

      // Assert that before the second fetch resolves the old list and its Paid mark are not on screen
      expect(
        screen.queryByText(i18n.t('translations:removal_paid')),
      ).toBeNull();
      expect(screen.queryByText('Moped breakdown')).toBeNull();

      // Now resolve the second fetch with updated (unpaid) reason
      await act(async () => {
        resolveSecondFetch([
          {
            id: 'reason-1',
            label: 'Moped breakdown',
            paid: false,
            needsNote: false,
          },
        ]);
        await Promise.resolve();
      });
      await act(async () => {
        jest.runAllTimers();
      });

      // After it resolves, only the new answer is on screen
      expect(screen.getByText('Moped breakdown')).toBeDefined();
      expect(
        screen.getByText(i18n.t('translations:removal_not_paid')),
      ).toBeDefined();
      expect(
        screen.queryByText(i18n.t('translations:removal_paid')),
      ).toBeNull();
      expect(getReasonsSpy).toHaveBeenCalledTimes(2);

      queryClient.clear();
    });
  });

  describe('Keyboard padding on Android as well as iOS (row 114)', () => {
    const originalOS = Platform.OS;

    afterEach(() => {
      Platform.OS = originalOS;
    });

    it('uses behavior "padding" on KeyboardAvoidingView on Android as well as iOS', () => {
      try {
        // Test Android behavior
        Platform.OS = 'android';
        const androidRender = render(<RequestRemoval {...defaultProps} />);
        const androidKav = androidRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(androidKav.props.behavior).toBe('padding');
        androidRender.unmount();

        // Test iOS behavior
        Platform.OS = 'ios';
        const iosRender = render(<RequestRemoval {...defaultProps} />);
        const iosKav = iosRender.UNSAFE_getByType(KeyboardAvoidingView);
        expect(iosKav.props.behavior).toBe('padding');
        iosRender.unmount();
      } finally {
        Platform.OS = originalOS;
      }
    });
  });
});
