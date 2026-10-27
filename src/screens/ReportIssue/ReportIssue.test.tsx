import React from 'react';
import { Alert } from 'react-native';
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
});
