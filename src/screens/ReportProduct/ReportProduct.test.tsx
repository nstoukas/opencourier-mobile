import React from 'react';
import { Alert } from 'react-native';
import axios, { AxiosError } from 'axios';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { ReportProduct } from './ReportProduct';
import { services } from '@app/services/service';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { Order } from '@app/types/types';

// Mock services so orderService.reportProduct can be controlled in tests
jest.mock('@app/services/service', () => ({
  services: {
    orderService: {
      reportProduct: jest.fn(),
    },
  },
}));

function createDeferred<T = any>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ReportProduct screen (spec 0032, AC-1, AC-2, AC-9)', () => {
  let alertSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const sampleOrder: Order = {
    id: 'del-prod-101',
    orderItems: [
      { name: 'Pork Gyros Pita', quantity: 2 },
      { name: 'Greek Salad', quantity: 1 },
      { name: 'Coca Cola 330ml', quantity: 1 },
    ],
  } as unknown as Order;

  const buildProps = (order: Order = sampleOrder): any => ({
    navigation: mockNavigation,
    route: {
      params: {
        order,
      },
    },
  });

  const getSendButton = () =>
    screen.UNSAFE_getByProps({
      title: i18n.t('translations:report_send'),
    });

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('Header and navigation', () => {
    it('renders the screen title and back button', () => {
      render(<ReportProduct {...buildProps()} />);

      expect(
        screen.getByText(i18n.t('translations:report_product')),
      ).toBeTruthy();

      const backButton = screen.UNSAFE_getByType(BackNavButton);
      expect(backButton).toBeTruthy();

      fireEvent.press(backButton);
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Item listing and initial selections', () => {
    it('lists order items plus Something else, selecting the first item and WRONG_ITEM by default', () => {
      render(<ReportProduct {...buildProps()} />);

      // Kind chips
      const wrongChip = screen.getByText(
        i18n.t('translations:report_product_wrong'),
      );
      const missingChip = screen.getByText(
        i18n.t('translations:report_product_missing'),
      );
      expect(wrongChip).toBeTruthy();
      expect(missingChip).toBeTruthy();

      // WRONG_ITEM should be selected by default
      const wrongTouchable = screen.getByRole('button', {
        name: i18n.t('translations:report_product_wrong'),
      });
      const missingTouchable = screen.getByRole('button', {
        name: i18n.t('translations:report_product_missing'),
      });
      expect(wrongTouchable.props.accessibilityState).toEqual({
        selected: true,
      });
      expect(missingTouchable.props.accessibilityState).toEqual({
        selected: false,
      });

      // Item chips
      expect(screen.getByText('Pork Gyros Pita')).toBeTruthy();
      expect(screen.getByText('Greek Salad')).toBeTruthy();
      expect(screen.getByText('Coca Cola 330ml')).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:report_product_something_else')),
      ).toBeTruthy();

      // First item is selected by default
      const firstItemTouchable = screen.getByRole('button', {
        name: 'Pork Gyros Pita',
      });
      const secondItemTouchable = screen.getByRole('button', {
        name: 'Greek Salad',
      });
      expect(firstItemTouchable.props.accessibilityState).toEqual({
        selected: true,
      });
      expect(secondItemTouchable.props.accessibilityState).toEqual({
        selected: false,
      });

      // Send button is enabled because an order item is selected
      expect(getSendButton().props.disabled).toBe(false);
    });

    it('defaults to Something else and disables Send button when order has no items', () => {
      const orderWithoutItems = {
        ...sampleOrder,
        orderItems: [],
      } as unknown as Order;

      render(<ReportProduct {...buildProps(orderWithoutItems)} />);

      const somethingElseTouchable = screen.getByRole('button', {
        name: i18n.t('translations:report_product_something_else'),
      });
      expect(somethingElseTouchable.props.accessibilityState).toEqual({
        selected: true,
      });

      // Without note, Send is disabled
      expect(getSendButton().props.disabled).toBe(true);
    });

    it('handles orderItems being undefined gracefully', () => {
      const orderUndefinedItems = {
        id: 'del-no-items',
        orderItems: undefined,
      } as unknown as Order;

      render(<ReportProduct {...buildProps(orderUndefinedItems)} />);

      expect(
        screen.getByText(i18n.t('translations:report_product_something_else')),
      ).toBeTruthy();
      expect(getSendButton().props.disabled).toBe(true);
    });
  });

  describe('Kind and item switching', () => {
    it('allows toggling between Wrong item and Missing item', async () => {
      render(<ReportProduct {...buildProps()} />);

      const wrongTouchable = screen.getByRole('button', {
        name: i18n.t('translations:report_product_wrong'),
      });
      const missingTouchable = screen.getByRole('button', {
        name: i18n.t('translations:report_product_missing'),
      });

      await act(async () => {
        fireEvent.press(missingTouchable);
      });

      expect(missingTouchable.props.accessibilityState).toEqual({
        selected: true,
      });
      expect(wrongTouchable.props.accessibilityState).toEqual({
        selected: false,
      });

      await act(async () => {
        fireEvent.press(wrongTouchable);
      });

      expect(wrongTouchable.props.accessibilityState).toEqual({
        selected: true,
      });
      expect(missingTouchable.props.accessibilityState).toEqual({
        selected: false,
      });
    });

    it('allows selecting another item or Something else', async () => {
      render(<ReportProduct {...buildProps()} />);

      const firstItem = screen.getByRole('button', { name: 'Pork Gyros Pita' });
      const secondItem = screen.getByRole('button', { name: 'Greek Salad' });
      const somethingElse = screen.getByRole('button', {
        name: i18n.t('translations:report_product_something_else'),
      });

      // Switch to Greek Salad
      await act(async () => {
        fireEvent.press(secondItem);
      });
      expect(secondItem.props.accessibilityState).toEqual({ selected: true });
      expect(firstItem.props.accessibilityState).toEqual({ selected: false });

      // Switch to Something else
      await act(async () => {
        fireEvent.press(somethingElse);
      });
      expect(somethingElse.props.accessibilityState).toEqual({ selected: true });
      expect(secondItem.props.accessibilityState).toEqual({ selected: false });
    });
  });

  describe('Validation and Send button state', () => {
    it('requires a non-empty note when Something else is selected', async () => {
      render(<ReportProduct {...buildProps()} />);

      const somethingElse = screen.getByRole('button', {
        name: i18n.t('translations:report_product_something_else'),
      });
      const noteInput = screen.getByPlaceholderText(
        i18n.t('translations:report_note_placeholder'),
      );

      // Select Something else: Send becomes disabled because note is empty
      await act(async () => {
        fireEvent.press(somethingElse);
      });
      expect(getSendButton().props.disabled).toBe(true);

      // Whitespace only: still disabled
      await act(async () => {
        fireEvent.changeText(noteInput, '     ');
      });
      expect(getSendButton().props.disabled).toBe(true);

      // Real text: enabled
      await act(async () => {
        fireEvent.changeText(noteInput, 'Customer received wrong brand of drink');
      });
      expect(getSendButton().props.disabled).toBe(false);

      // Clearing note back: disabled
      await act(async () => {
        fireEvent.changeText(noteInput, '');
      });
      expect(getSendButton().props.disabled).toBe(true);
    });

    it('keeps Send button enabled when a named item is selected, even with no note', async () => {
      render(<ReportProduct {...buildProps()} />);

      const noteInput = screen.getByPlaceholderText(
        i18n.t('translations:report_note_placeholder'),
      );

      // Initial state: first item selected, note empty -> enabled
      expect(getSendButton().props.disabled).toBe(false);

      // Typing whitespace into note while an item is selected keeps it enabled
      await act(async () => {
        fireEvent.changeText(noteInput, '   ');
      });
      expect(getSendButton().props.disabled).toBe(false);
    });
  });

  describe('Sending product report (Happy path)', () => {
    it('sends default WRONG_ITEM with selected item and undefined note when note is empty', async () => {
      (services.orderService.reportProduct as jest.Mock).mockResolvedValue({
        data: {},
      });

      render(<ReportProduct {...buildProps()} />);

      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:report_send')),
        );
      });

      expect(services.orderService.reportProduct).toHaveBeenCalledTimes(1);
      expect(services.orderService.reportProduct).toHaveBeenCalledWith({
        id: 'del-prod-101',
        kind: 'WRONG_ITEM',
        itemName: 'Pork Gyros Pita',
        note: undefined,
      });

      // Shows thank you alert with OK button
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:thanks_for_report'),
        '',
        [
          expect.objectContaining({
            text: 'OK',
            onPress: expect.any(Function),
          }),
        ],
      );

      // Pressing OK navigates back
      const okAction = alertSpy.mock.calls[0][2][0];
      act(() => {
        okAction.onPress();
      });
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('sends MISSING_ITEM with chosen item and trimmed note', async () => {
      (services.orderService.reportProduct as jest.Mock).mockResolvedValue({
        data: {},
      });

      render(<ReportProduct {...buildProps()} />);

      // Select MISSING_ITEM
      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:report_product_missing')),
        );
      });

      // Select Greek Salad
      await act(async () => {
        fireEvent.press(screen.getByText('Greek Salad'));
      });

      // Type note with leading/trailing spaces
      const noteInput = screen.getByPlaceholderText(
        i18n.t('translations:report_note_placeholder'),
      );
      await act(async () => {
        fireEvent.changeText(noteInput, '   The salad was missing from bag   ');
      });

      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:report_send')),
        );
      });

      expect(services.orderService.reportProduct).toHaveBeenCalledWith({
        id: 'del-prod-101',
        kind: 'MISSING_ITEM',
        itemName: 'Greek Salad',
        note: 'The salad was missing from bag',
      });
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:thanks_for_report'),
        '',
        expect.any(Array),
      );
    });

    it('sends report with undefined itemName when Something else is selected with note', async () => {
      (services.orderService.reportProduct as jest.Mock).mockResolvedValue({
        data: {},
      });

      render(<ReportProduct {...buildProps()} />);

      // Select Something else
      await act(async () => {
        fireEvent.press(
          screen.getByText(
            i18n.t('translations:report_product_something_else'),
          ),
        );
      });

      // Type note
      const noteInput = screen.getByPlaceholderText(
        i18n.t('translations:report_note_placeholder'),
      );
      await act(async () => {
        fireEvent.changeText(noteInput, 'Extra tzatziki sauce was omitted');
      });

      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:report_send')),
        );
      });

      expect(services.orderService.reportProduct).toHaveBeenCalledWith({
        id: 'del-prod-101',
        kind: 'WRONG_ITEM',
        itemName: undefined,
        note: 'Extra tzatziki sauce was omitted',
      });
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:thanks_for_report'),
        '',
        expect.any(Array),
      );
    });
  });

  describe('In-flight state and duplicate submissions', () => {
    it('disables button and prevents duplicate submissions while request is in flight', async () => {
      const deferred = createDeferred();
      (services.orderService.reportProduct as jest.Mock).mockReturnValue(
        deferred.promise,
      );

      render(<ReportProduct {...buildProps()} />);

      // First tap
      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:report_send')),
        );
      });

      expect(services.orderService.reportProduct).toHaveBeenCalledTimes(1);
      expect(getSendButton().props.disabled).toBe(true);
      expect(getSendButton().props.isLoading).toBe(true);

      // Attempt second tap while in-flight
      await act(async () => {
        fireEvent.press(getSendButton());
      });
      expect(services.orderService.reportProduct).toHaveBeenCalledTimes(1);

      // Resolve the promise
      await act(async () => {
        deferred.resolve({ data: {} });
      });

      expect(alertSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling (Failure cases)', () => {
    it('shows refused alert body when server refuses with HTTP error response', async () => {
      const axiosRefusedError = new AxiosError('Conflict');
      axiosRefusedError.response = {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: { message: 'Status conflict' },
      };

      (services.orderService.reportProduct as jest.Mock).mockRejectedValue(
        axiosRefusedError,
      );

      render(<ReportProduct {...buildProps()} />);

      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:report_send')),
        );
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:report_failed_title'),
        i18n.t('translations:report_product_refused_body'),
      );
      // Rider stays on the screen so they know what happened
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
      // Button re-enabled after failure
      expect(getSendButton().props.disabled).toBe(false);
    });

    it('shows network failure alert body when network fails without response', async () => {
      const networkError = new AxiosError('Network error');
      // No response property simulates no network / timeout

      (services.orderService.reportProduct as jest.Mock).mockRejectedValue(
        networkError,
      );

      render(<ReportProduct {...buildProps()} />);

      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:report_send')),
        );
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:report_failed_title'),
        i18n.t('translations:report_failed_body'),
      );
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
      expect(getSendButton().props.disabled).toBe(false);
    });

    it('shows network failure alert body on generic non-Axios error', async () => {
      (services.orderService.reportProduct as jest.Mock).mockRejectedValue(
        new Error('Unexpected exception'),
      );

      render(<ReportProduct {...buildProps()} />);

      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:report_send')),
        );
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:report_failed_title'),
        i18n.t('translations:report_failed_body'),
      );
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
      expect(getSendButton().props.disabled).toBe(false);
    });
  });
});
