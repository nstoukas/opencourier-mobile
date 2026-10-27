import React from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { ReportIssue } from './ReportIssue';
import { services } from '@app/services/service';
import { DeliveryIssueReason } from '@app/types/enums';
import i18n from '@app/localization/i18n';

// Mock services so orderService.reportIssue can be controlled in tests
jest.mock('@app/services/service', () => ({
  services: {
    orderService: {
      reportIssue: jest.fn(),
    },
  },
}));

// Creates a deferred promise whose resolve/reject can be triggered at any time
function createDeferred<T = any>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ReportIssue screen (decision 66.11)', () => {
  let alertSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  const mockOrder = {
    id: 'test-order-456',
  } as any;

  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
    route: {
      params: {
        order: mockOrder,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('Clause 2: Each row sends its own reason with order.id', () => {
    it('sends WRONG_ADDRESS when Wrong address row is pressed', async () => {
      (services.orderService.reportIssue as jest.Mock).mockResolvedValue({
        data: {},
      });

      render(<ReportIssue {...defaultProps} />);

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:wrong_address')));
      });

      expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);
      expect(services.orderService.reportIssue).toHaveBeenCalledWith({
        id: 'test-order-456',
        reason: DeliveryIssueReason.WrongAddress,
      });
    });

    it('sends NO_SIGNAL when No signal row is pressed', async () => {
      (services.orderService.reportIssue as jest.Mock).mockResolvedValue({
        data: {},
      });

      render(<ReportIssue {...defaultProps} />);

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:no_signal')));
      });

      expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);
      expect(services.orderService.reportIssue).toHaveBeenCalledWith({
        id: 'test-order-456',
        reason: DeliveryIssueReason.NoSignal,
      });
    });

    it('sends ORDER_HANDED when Order handed row is pressed', async () => {
      (services.orderService.reportIssue as jest.Mock).mockResolvedValue({
        data: {},
      });

      render(<ReportIssue {...defaultProps} />);

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:order_handed')));
      });

      expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);
      expect(services.orderService.reportIssue).toHaveBeenCalledWith({
        id: 'test-order-456',
        reason: DeliveryIssueReason.OrderHanded,
      });
    });
  });

  describe('Clause 3: Thank you view appears ONLY after reportIssue resolves', () => {
    it('does not show thank you view while pending, and shows it once resolved', async () => {
      const deferred = createDeferred();
      (services.orderService.reportIssue as jest.Mock).mockReturnValue(
        deferred.promise,
      );

      render(<ReportIssue {...defaultProps} />);

      // Initially neither thank you text nor the back button are shown
      expect(
        screen.queryByText(i18n.t('translations:thanks_for_report')),
      ).toBeNull();
      expect(
        screen.queryByText(i18n.t('translations:report_sent_back')),
      ).toBeNull();

      // Tap an issue row to start sending
      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:wrong_address')));
      });

      // While call is pending, thank you view is still NOT shown
      expect(
        screen.queryByText(i18n.t('translations:thanks_for_report')),
      ).toBeNull();
      expect(
        screen.queryByText(i18n.t('translations:report_sent_back')),
      ).toBeNull();
      expect(
        screen.getByText(i18n.t('translations:wrong_address')),
      ).toBeTruthy();

      // Resolve reportIssue
      await act(async () => {
        deferred.resolve({ data: {} });
      });

      // After resolution: thank you view and back button are shown, rows are gone
      expect(
        screen.getByText(i18n.t('translations:thanks_for_report')),
      ).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:report_sent_back')),
      ).toBeTruthy();
      expect(
        screen.queryByText(i18n.t('translations:wrong_address')),
      ).toBeNull();
    });
  });

  describe('Clause 4: When reportIssue rejects, shows alert, keeps rows, and unlocks screen', () => {
    it('alerts with failure title and body, keeps rows on screen, and allows subsequent taps', async () => {
      const deferred = createDeferred();
      (services.orderService.reportIssue as jest.Mock).mockReturnValue(
        deferred.promise,
      );

      render(<ReportIssue {...defaultProps} />);

      // Tap an issue row
      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:wrong_address')));
      });

      // Reject the call
      await act(async () => {
        deferred.reject(new Error('Network disconnected'));
      });

      // Alert.alert must be called with failure title and body
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:report_failed_title'),
        i18n.t('translations:report_failed_body'),
      );

      // Thank you view does NOT appear
      expect(
        screen.queryByText(i18n.t('translations:thanks_for_report')),
      ).toBeNull();
      expect(
        screen.queryByText(i18n.t('translations:report_sent_back')),
      ).toBeNull();

      // The three rows stay on screen
      expect(
        screen.getByText(i18n.t('translations:wrong_address')),
      ).toBeTruthy();
      expect(screen.getByText(i18n.t('translations:no_signal'))).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:order_handed')),
      ).toBeTruthy();

      // Screen is not left locked: a later tap calls reportIssue again
      const retryDeferred = createDeferred();
      (services.orderService.reportIssue as jest.Mock).mockReturnValue(
        retryDeferred.promise,
      );

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:no_signal')));
      });

      expect(services.orderService.reportIssue).toHaveBeenCalledTimes(2);
      expect(services.orderService.reportIssue).toHaveBeenLastCalledWith({
        id: 'test-order-456',
        reason: DeliveryIssueReason.NoSignal,
      });

      // When the retry resolves, thank you view appears
      await act(async () => {
        retryDeferred.resolve({ data: {} });
      });
      expect(
        screen.getByText(i18n.t('translations:thanks_for_report')),
      ).toBeTruthy();
    });
  });

  describe('Clause 5: Exactly one call for a double tap while pending', () => {
    it('does not send a second report when tapped twice while pending', async () => {
      const deferred = createDeferred();
      (services.orderService.reportIssue as jest.Mock).mockReturnValue(
        deferred.promise,
      );

      render(<ReportIssue {...defaultProps} />);

      // First tap begins sending
      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:wrong_address')));
      });
      expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);

      // Second tap on the same or another row while call is in flight
      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:wrong_address')));
      });
      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:no_signal')));
      });

      // Still exactly one call
      expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);

      // Clean up pending promise
      await act(async () => {
        deferred.resolve({ data: {} });
      });
    });
  });

  describe('Clause 6: "Back to the delivery" button calls navigation.goBack', () => {
    it('calls navigation.goBack when "Back to the delivery" is pressed', async () => {
      (services.orderService.reportIssue as jest.Mock).mockResolvedValue({
        data: {},
      });

      render(<ReportIssue {...defaultProps} />);

      // Trigger resolution so thank you view is displayed
      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:wrong_address')));
      });

      const backToDeliveryButton = screen.getByText(
        i18n.t('translations:report_sent_back'),
      );
      expect(backToDeliveryButton).toBeTruthy();

      fireEvent.press(backToDeliveryButton);
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Report issue offers Other, with a note (decision 66.16)', () => {
    describe('Clause 1: Offers a fourth row, Other, beside the three existing reasons', () => {
      it('renders all four reason rows: wrong address, no signal, order handed over, and other', () => {
        render(<ReportIssue {...defaultProps} />);

        expect(
          screen.getByText(i18n.t('translations:wrong_address')),
        ).toBeTruthy();
        expect(screen.getByText(i18n.t('translations:no_signal'))).toBeTruthy();
        expect(
          screen.getByText(i18n.t('translations:order_handed')),
        ).toBeTruthy();
        expect(screen.getByText(i18n.t('translations:other'))).toBeTruthy();
      });
    });

    describe('Clause 2: Tapping Other does NOT send anything and opens a note field on the same screen', () => {
      it('does not call orderService.reportIssue and opens the note field on the same screen', async () => {
        render(<ReportIssue {...defaultProps} />);

        // Note field is not visible initially
        expect(
          screen.queryByPlaceholderText(
            i18n.t('translations:report_note_placeholder'),
          ),
        ).toBeNull();

        // Tap "Other" row
        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:other')));
        });

        // Does NOT send anything
        expect(services.orderService.reportIssue).not.toHaveBeenCalled();

        // Opens note field on the same screen
        expect(
          screen.getByPlaceholderText(
            i18n.t('translations:report_note_placeholder'),
          ),
        ).toBeTruthy();

        // The reason rows remain visible on the same screen
        expect(screen.getByText(i18n.t('translations:other'))).toBeTruthy();
        expect(
          screen.getByText(i18n.t('translations:wrong_address')),
        ).toBeTruthy();
      });
    });

    describe('Clause 3: Note field allows 500 characters at most with a visible counter "n/500"', () => {
      it('has maxLength of 500 and updates counter as text changes', async () => {
        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:other')));
        });

        const input = screen.getByPlaceholderText(
          i18n.t('translations:report_note_placeholder'),
        );
        expect(input.props.maxLength).toBe(500);

        // Initially counter shows 0/500
        expect(screen.getByText('0/500')).toBeTruthy();

        // Change text to 20 characters
        await act(async () => {
          fireEvent.changeText(input, 'Customer not at home');
        });
        expect(screen.getByText('20/500')).toBeTruthy();

        // Change text to 500 characters
        const maxNote = 'A'.repeat(500);
        await act(async () => {
          fireEvent.changeText(input, maxNote);
        });
        expect(screen.getByText('500/500')).toBeTruthy();
      });
    });

    describe('Clause 4: Send report is disabled while note is empty or whitespace only, enabled with real text', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('disables Send report when empty, spaces, tabs, or newlines, and enables when note has real text', async () => {
        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:other')));
        });

        const input = screen.getByPlaceholderText(
          i18n.t('translations:report_note_placeholder'),
        );
        const getSendButton = () =>
          screen.UNSAFE_getByProps({
            title: i18n.t('translations:report_send'),
          });

        const pressSendButton = async () => {
          await act(async () => {
            fireEvent.press(
              screen.getByText(i18n.t('translations:report_send')),
            );
            jest.runOnlyPendingTimers();
          });
        };

        // 1. Initially empty: button is disabled, press does not send
        expect(getSendButton().props.disabled).toBe(true);
        await pressSendButton();
        expect(services.orderService.reportIssue).not.toHaveBeenCalled();

        // 2. Spaces only: disabled
        await act(async () => {
          fireEvent.changeText(input, '    ');
        });
        expect(getSendButton().props.disabled).toBe(true);
        await pressSendButton();
        expect(services.orderService.reportIssue).not.toHaveBeenCalled();

        // 3. Tabs only: disabled
        await act(async () => {
          fireEvent.changeText(input, '\t\t');
        });
        expect(getSendButton().props.disabled).toBe(true);
        await pressSendButton();
        expect(services.orderService.reportIssue).not.toHaveBeenCalled();

        // 4. Newlines only: disabled
        await act(async () => {
          fireEvent.changeText(input, '\n\n\r\n');
        });
        expect(getSendButton().props.disabled).toBe(true);
        await pressSendButton();
        expect(services.orderService.reportIssue).not.toHaveBeenCalled();

        // 5. Mixed whitespace: disabled
        await act(async () => {
          fireEvent.changeText(input, '  \t \n  ');
        });
        expect(getSendButton().props.disabled).toBe(true);
        await pressSendButton();
        expect(services.orderService.reportIssue).not.toHaveBeenCalled();

        // 6. Real text: enabled
        await act(async () => {
          fireEvent.changeText(input, 'Access code was rejected');
        });
        expect(getSendButton().props.disabled).toBe(false);

        // 7. Erasing back to spaces disables it again
        await act(async () => {
          fireEvent.changeText(input, '  ');
        });
        expect(getSendButton().props.disabled).toBe(true);
        await pressSendButton();
        expect(services.orderService.reportIssue).not.toHaveBeenCalled();
      });
    });

    describe('Clause 5: Send report sends { reason: OTHER, note } with note trimmed to orderService.reportIssue', () => {
      it('trims note and sends reason: OTHER with trimmed note', async () => {
        (services.orderService.reportIssue as jest.Mock).mockResolvedValue({
          data: {},
        });

        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:other')));
        });

        const input = screen.getByPlaceholderText(
          i18n.t('translations:report_note_placeholder'),
        );

        // Note with leading and trailing whitespace and newlines
        await act(async () => {
          fireEvent.changeText(
            input,
            '   Customer changed delivery instructions to rear gate \n  ',
          );
        });

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:report_send')));
        });

        expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);
        expect(services.orderService.reportIssue).toHaveBeenCalledWith({
          id: 'test-order-456',
          reason: DeliveryIssueReason.Other,
          note: 'Customer changed delivery instructions to rear gate',
        });

        // When resolved, thank you view appears
        expect(
          screen.getByText(i18n.t('translations:thanks_for_report')),
        ).toBeTruthy();
      });
    });

    describe('Clause 6: The three other rows still send at once with { reason } alone and NO note', () => {
      it('sends WRONG_ADDRESS at once without note and does not open note field', async () => {
        (services.orderService.reportIssue as jest.Mock).mockResolvedValue({
          data: {},
        });

        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(
            screen.getByText(i18n.t('translations:wrong_address')),
          );
        });

        expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);
        const calledArgs = (services.orderService.reportIssue as jest.Mock).mock
          .calls[0][0];
        expect(calledArgs.id).toBe('test-order-456');
        expect(calledArgs.reason).toBe(DeliveryIssueReason.WrongAddress);
        expect(calledArgs.note).toBeUndefined();

        // Note input was never opened
        expect(
          screen.queryByPlaceholderText(
            i18n.t('translations:report_note_placeholder'),
          ),
        ).toBeNull();
      });

      it('sends NO_SIGNAL at once with note: undefined', async () => {
        (services.orderService.reportIssue as jest.Mock).mockResolvedValue({
          data: {},
        });

        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:no_signal')));
        });

        expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);
        const calledArgs = (services.orderService.reportIssue as jest.Mock).mock
          .calls[0][0];
        expect(calledArgs.reason).toBe(DeliveryIssueReason.NoSignal);
        expect(calledArgs.note).toBeUndefined();
      });

      it('sends ORDER_HANDED at once with note: undefined', async () => {
        (services.orderService.reportIssue as jest.Mock).mockResolvedValue({
          data: {},
        });

        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(
            screen.getByText(i18n.t('translations:order_handed')),
          );
        });

        expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);
        const calledArgs = (services.orderService.reportIssue as jest.Mock).mock
          .calls[0][0];
        expect(calledArgs.reason).toBe(DeliveryIssueReason.OrderHanded);
        expect(calledArgs.note).toBeUndefined();
      });
    });

    describe('Clause 7: While report is sending via Other, a second tap cannot send it twice', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('prevents duplicate sends when Send report is pressed multiple times while pending', async () => {
        const deferred = createDeferred();
        (services.orderService.reportIssue as jest.Mock).mockReturnValue(
          deferred.promise,
        );

        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:other')));
        });

        const input = screen.getByPlaceholderText(
          i18n.t('translations:report_note_placeholder'),
        );
        await act(async () => {
          fireEvent.changeText(input, 'Intercom broken');
        });

        const getSendButton = () =>
          screen.UNSAFE_getByProps({
            title: i18n.t('translations:report_send'),
          });

        // First tap on Send report starts sending
        await act(async () => {
          fireEvent.press(getSendButton());
        });
        expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);

        // While sending is true, the button is disabled and loading
        expect(getSendButton().props.disabled).toBe(true);
        expect(getSendButton().props.isLoading).toBe(true);

        // Attempt second tap on Send report while in flight
        await act(async () => {
          fireEvent.press(getSendButton());
        });

        // Attempt tap on another row while in flight
        await act(async () => {
          fireEvent.press(
            screen.getByText(i18n.t('translations:wrong_address')),
          );
        });

        // Still only one call
        expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);

        // Resolve call
        await act(async () => {
          deferred.resolve({ data: {} });
          jest.runOnlyPendingTimers();
        });

        expect(
          screen.getByText(i18n.t('translations:thanks_for_report')),
        ).toBeTruthy();
      });
    });

    describe('Clause 8: A failed send via Other shows failure alert and does not show thank you state', () => {
      it('shows failure alert, preserves note field and content, does not show thank you, and unlocks for retry', async () => {
        const deferred = createDeferred();
        (services.orderService.reportIssue as jest.Mock).mockReturnValue(
          deferred.promise,
        );

        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:other')));
        });

        const input = screen.getByPlaceholderText(
          i18n.t('translations:report_note_placeholder'),
        );
        await act(async () => {
          fireEvent.changeText(input, 'Road was closed for parade');
        });

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:report_send')));
        });

        // Reject the pending call
        await act(async () => {
          deferred.reject(new Error('Connection lost'));
        });

        // Failure alert is shown
        expect(alertSpy).toHaveBeenCalledTimes(1);
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:report_failed_title'),
          i18n.t('translations:report_failed_body'),
        );

        // Thank you state is NOT shown
        expect(
          screen.queryByText(i18n.t('translations:thanks_for_report')),
        ).toBeNull();
        expect(
          screen.queryByText(i18n.t('translations:report_sent_back')),
        ).toBeNull();

        // Note input is still on screen and preserves the typed text
        expect(
          screen.getByPlaceholderText(
            i18n.t('translations:report_note_placeholder'),
          ),
        ).toBeTruthy();
        expect(input.props.value).toBe('Road was closed for parade');

        // Send button is unlocked so rider can retry
        const retryDeferred = createDeferred();
        (services.orderService.reportIssue as jest.Mock).mockReturnValue(
          retryDeferred.promise,
        );

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:report_send')));
        });

        expect(services.orderService.reportIssue).toHaveBeenCalledTimes(2);
        expect(services.orderService.reportIssue).toHaveBeenLastCalledWith({
          id: 'test-order-456',
          reason: DeliveryIssueReason.Other,
          note: 'Road was closed for parade',
        });

        // Successful retry shows thank you
        await act(async () => {
          retryDeferred.resolve({ data: {} });
        });
        expect(
          screen.getByText(i18n.t('translations:thanks_for_report')),
        ).toBeTruthy();
      });
    });
  });

  describe('Review rulings & Decision 66.17 (rows wait, refused vs failed, failure log)', () => {
    describe('Decision 66.17, rows wait: while note has non-blank text, tapping other rows sends nothing', () => {
      it('while the note has non-blank text, tapping Wrong address, No signal or Order handed sends nothing', async () => {
        render(<ReportIssue {...defaultProps} />);

        // Open note box via Other
        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:other')));
        });

        const input = screen.getByPlaceholderText(
          i18n.t('translations:report_note_placeholder'),
        );

        // Type non-blank text into the note
        await act(async () => {
          fireEvent.changeText(
            input,
            'Customer requested delivery at back entrance',
          );
        });

        // Tapping the other rows does not trigger a send
        await act(async () => {
          fireEvent.press(
            screen.getByText(i18n.t('translations:wrong_address')),
          );
        });
        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:no_signal')));
        });
        await act(async () => {
          fireEvent.press(
            screen.getByText(i18n.t('translations:order_handed')),
          );
        });

        // Nothing sent
        expect(services.orderService.reportIssue).not.toHaveBeenCalled();

        // Thank you view is not shown, and typed note stays
        expect(
          screen.queryByText(i18n.t('translations:thanks_for_report')),
        ).toBeNull();
        expect(input.props.value).toBe(
          'Customer requested delivery at back entrance',
        );
      });

      it('with an empty or blank note, Wrong address, No signal and Order handed send at once as before', async () => {
        (services.orderService.reportIssue as jest.Mock).mockResolvedValue({
          data: {},
        });

        // 1. With empty note (writingNote is open, but note is "")
        const { unmount } = render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:other')));
        });

        // Note is empty: tapping Wrong address sends at once
        await act(async () => {
          fireEvent.press(
            screen.getByText(i18n.t('translations:wrong_address')),
          );
        });

        expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);
        expect(services.orderService.reportIssue).toHaveBeenCalledWith({
          id: 'test-order-456',
          reason: DeliveryIssueReason.WrongAddress,
        });

        unmount();
        jest.clearAllMocks();

        // 2. With blank note (whitespace only: spaces, tabs, newlines)
        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:other')));
        });

        const input = screen.getByPlaceholderText(
          i18n.t('translations:report_note_placeholder'),
        );
        await act(async () => {
          fireEvent.changeText(input, '   \t\n   ');
        });

        // Note is blank: tapping No signal sends at once
        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:no_signal')));
        });

        expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);
        expect(services.orderService.reportIssue).toHaveBeenCalledWith({
          id: 'test-order-456',
          reason: DeliveryIssueReason.NoSignal,
        });
      });

      it('clearing the note re-enables Wrong address, No signal and Order handed to send', async () => {
        (services.orderService.reportIssue as jest.Mock).mockResolvedValue({
          data: {},
        });

        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:other')));
        });

        const input = screen.getByPlaceholderText(
          i18n.t('translations:report_note_placeholder'),
        );

        // Type note -> rows are waiting
        await act(async () => {
          fireEvent.changeText(input, 'Intercom broken');
        });

        await act(async () => {
          fireEvent.press(
            screen.getByText(i18n.t('translations:order_handed')),
          );
        });
        expect(services.orderService.reportIssue).not.toHaveBeenCalled();

        // Clear the note
        await act(async () => {
          fireEvent.changeText(input, '');
        });

        // Now tapping Order handed sends at once
        await act(async () => {
          fireEvent.press(
            screen.getByText(i18n.t('translations:order_handed')),
          );
        });

        expect(services.orderService.reportIssue).toHaveBeenCalledTimes(1);
        expect(services.orderService.reportIssue).toHaveBeenCalledWith({
          id: 'test-order-456',
          reason: DeliveryIssueReason.OrderHanded,
        });
      });
    });

    describe('Decision 66.17, refused: alert body differentiates server response from network failure', () => {
      it('when reportIssue rejects with an axios error that has a response (e.g. 404), alert body is report_refused_body, no thank you, and note stays', async () => {
        const axiosError404 = new axios.AxiosError(
          'Request failed with status code 404',
          'ERR_BAD_REQUEST',
          undefined,
          undefined,
          {
            status: 404,
            statusText: 'Not Found',
            data: { message: 'Delivery not found or no longer assigned' },
            headers: {},
            config: {} as any,
          },
        );

        (services.orderService.reportIssue as jest.Mock).mockRejectedValue(
          axiosError404,
        );

        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:other')));
        });

        const input = screen.getByPlaceholderText(
          i18n.t('translations:report_note_placeholder'),
        );
        await act(async () => {
          fireEvent.changeText(input, 'Building security denied entry');
        });

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:report_send')));
        });

        // Alert body is report_refused_body
        expect(alertSpy).toHaveBeenCalledTimes(1);
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:report_failed_title'),
          i18n.t('translations:report_refused_body'),
        );

        // No thank you view
        expect(
          screen.queryByText(i18n.t('translations:thanks_for_report')),
        ).toBeNull();

        // The note stays on screen
        expect(
          screen.getByPlaceholderText(
            i18n.t('translations:report_note_placeholder'),
          ),
        ).toBeTruthy();
        expect(input.props.value).toBe('Building security denied entry');
      });

      it('when reportIssue rejects with an axios error with no response (network error), alert body is report_failed_body, no thank you, and note stays', async () => {
        const networkError = new axios.AxiosError(
          'Network Error',
          'ERR_NETWORK',
          undefined,
          undefined,
          undefined, // no response!
        );

        (services.orderService.reportIssue as jest.Mock).mockRejectedValue(
          networkError,
        );

        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:other')));
        });

        const input = screen.getByPlaceholderText(
          i18n.t('translations:report_note_placeholder'),
        );
        await act(async () => {
          fireEvent.changeText(input, 'Elevator out of order');
        });

        await act(async () => {
          fireEvent.press(screen.getByText(i18n.t('translations:report_send')));
        });

        // Alert body is report_failed_body
        expect(alertSpy).toHaveBeenCalledTimes(1);
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:report_failed_title'),
          i18n.t('translations:report_failed_body'),
        );

        // No thank you view
        expect(
          screen.queryByText(i18n.t('translations:thanks_for_report')),
        ).toBeNull();

        // The note stays on screen
        expect(
          screen.getByPlaceholderText(
            i18n.t('translations:report_note_placeholder'),
          ),
        ).toBeTruthy();
        expect(input.props.value).toBe('Elevator out of order');
      });

      it('when reportIssue rejects with a plain Error (no response), alert body is report_failed_body', async () => {
        (services.orderService.reportIssue as jest.Mock).mockRejectedValue(
          new Error('Connection dropped'),
        );

        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(
            screen.getByText(i18n.t('translations:wrong_address')),
          );
        });

        expect(alertSpy).toHaveBeenCalledTimes(1);
        expect(alertSpy).toHaveBeenCalledWith(
          i18n.t('translations:report_failed_title'),
          i18n.t('translations:report_failed_body'),
        );
      });
    });

    describe('Failure log does not print the whole error object (Nit & review ruling)', () => {
      it('prints only the error message and never the whole error object', async () => {
        const sensitiveError = new Error('Sensitive socket error with auth key');
        (services.orderService.reportIssue as jest.Mock).mockRejectedValue(
          sensitiveError,
        );

        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(
            screen.getByText(i18n.t('translations:wrong_address')),
          );
        });

        // console.log is called with the message string only
        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Could not send the report',
          'Sensitive socket error with auth key',
        );
        // Ensure the error object itself is NOT passed to console.log
        expect(consoleLogSpy).not.toHaveBeenCalledWith(
          'Could not send the report',
          sensitiveError,
        );
      });

      it('prints only the axios error message and never the axios error object with request config', async () => {
        const axiosError = new axios.AxiosError(
          'Request failed with status code 500',
          'ERR_BAD_RESPONSE',
          {
            headers: { Authorization: 'Bearer sensitive-courier-token-xyz' },
          } as any,
        );
        (services.orderService.reportIssue as jest.Mock).mockRejectedValue(
          axiosError,
        );

        render(<ReportIssue {...defaultProps} />);

        await act(async () => {
          fireEvent.press(
            screen.getByText(i18n.t('translations:wrong_address')),
          );
        });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Could not send the report',
          'Request failed with status code 500',
        );
        expect(consoleLogSpy).not.toHaveBeenCalledWith(
          'Could not send the report',
          axiosError,
        );
      });
    });
  });
});
