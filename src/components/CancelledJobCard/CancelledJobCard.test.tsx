import React from 'react';
import { Linking } from 'react-native';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CancelledJobCard } from './CancelledJobCard';
import { useCancelledJobs } from '@app/hooks/useCancelledJobs';
import {
  acknowledgeJob,
  CancelledJob,
  loadAcknowledged,
  sendFoodOutcome,
} from '@app/services/cancelledJobs/cancelledJobs';
import { QueryKeys } from '@app/utilities/queryKeys';
import i18n from '@app/localization/i18n';

jest.mock('@app/hooks/useCancelledJobs');

jest.mock('@app/services/cancelledJobs/cancelledJobs', () => {
  const actual = jest.requireActual(
    '@app/services/cancelledJobs/cancelledJobs',
  );
  return {
    ...actual,
    loadAcknowledged: jest.fn(),
    acknowledgeJob: jest.fn(),
    sendFoodOutcome: jest.fn(),
  };
});

describe('CancelledJobCard (spec 0015, AC-7, AC-8, AC-11, AC-12, decisions 32.9, 32.16)', () => {
  let queryClient: QueryClient;

  const samplePickedUpJob: CancelledJob = {
    id: 'del-picked-up-1',
    orderReference: 'ORD-999',
    pickupName: 'Ouzeri Taverna',
    pickupBusinessName: 'Ouzeri Volos',
    pickupAddress: 'Argonafton 12, Volos',
    pickupPhoneNumber: '+302421011111',
    cancelledBy: 'RESTAURANT',
    cancelledAt: '2026-11-01T12:00:00Z',
    pickedUp: true,
    payAmount: 350,
    currencyCode: 'EUR',
    foodOutcome: null,
  };

  const sampleNotPickedUpJob: CancelledJob = {
    id: 'del-pre-pickup-2',
    orderReference: 'ORD-888',
    pickupName: 'Burger Queen',
    pickupBusinessName: 'Burger Queen Store',
    pickupAddress: 'Iasonos 40, Volos',
    pickupPhoneNumber: '+302421022222',
    cancelledBy: 'CUSTOMER',
    cancelledAt: '2026-11-01T12:05:00Z',
    pickedUp: false,
    payAmount: null,
    currencyCode: 'EUR',
    foodOutcome: null,
  };

  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    (loadAcknowledged as jest.Mock).mockResolvedValue(new Set());
    (acknowledgeJob as jest.Mock).mockResolvedValue(undefined);
    (sendFoodOutcome as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders nothing when jobs is undefined or empty', async () => {
    (useCancelledJobs as jest.Mock).mockReturnValue({ data: [] });

    const { toJSON } = render(<CancelledJobCard />, {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(loadAcknowledged).toHaveBeenCalled());
    expect(toJSON()).toBeNull();
  });

  describe('No flash on restart (Item 9)', () => {
    it('renders nothing while loadAcknowledged is in flight even if a pre-pickup job exists', async () => {
      let resolveLoad!: (s: Set<string>) => void;
      const loadPromise = new Promise<Set<string>>(resolve => {
        resolveLoad = resolve;
      });
      (loadAcknowledged as jest.Mock).mockReturnValue(loadPromise);
      (useCancelledJobs as jest.Mock).mockReturnValue({
        data: [sampleNotPickedUpJob],
      });

      const { toJSON } = render(<CancelledJobCard />, {
        wrapper: createWrapper(),
      });

      // Before loadAcknowledged settles, acknowledged is null, so card renders nothing
      expect(toJSON()).toBeNull();

      // Resolve loadAcknowledged with sampleNotPickedUpJob acknowledged
      await act(async () => {
        resolveLoad(new Set(['del-pre-pickup-2']));
      });

      // Still renders nothing: acknowledged job is filtered out without ever flashing on screen
      expect(toJSON()).toBeNull();
    });

    it('falls back to empty set and shows the job when loadAcknowledged rejects (safe direction)', async () => {
      (loadAcknowledged as jest.Mock).mockRejectedValue(
        new Error('Storage failure'),
      );
      (useCancelledJobs as jest.Mock).mockReturnValue({
        data: [sampleNotPickedUpJob],
      });

      render(<CancelledJobCard />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('cancelled-job-card')).toBeTruthy();
      });
    });
  });

  describe('Card details and customer data exclusion (AC-7, AC-11)', () => {
    it('renders picked up job details with formatted pay, address, and call button', async () => {
      jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
      (useCancelledJobs as jest.Mock).mockReturnValue({
        data: [samplePickedUpJob],
      });

      render(<CancelledJobCard />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('cancelled-job-card')).toBeTruthy();
      });

      // Title and body with restaurant and canceller
      expect(
        screen.getByText(i18n.t('translations:cancelled_title')),
      ).toBeTruthy();
      expect(
        screen.getByText('Ouzeri Volos: cancelled by the restaurant.'),
      ).toBeTruthy();

      // Formatted pay: 350 cents -> €3.50
      expect(screen.getByText('You are paid €3.50 for this job.')).toBeTruthy();

      // Food instructions and restaurant pickup address
      expect(screen.getByText('Bring it back to Ouzeri Volos.')).toBeTruthy();
      expect(screen.getByText('Argonafton 12, Volos')).toBeTruthy();

      // Call restaurant button
      const callButton = screen.getByText(
        i18n.t('translations:call_restaurant'),
      );
      expect(callButton).toBeTruthy();
      fireEvent.press(callButton);
      expect(Linking.openURL).toHaveBeenCalledWith('tel:+302421011111');

      // Crucial: AC-11 no customer field is ever rendered
      expect(screen.queryByText(/customer/i)).toBeNull();
      expect(screen.queryByText(/dropoff/i)).toBeNull();
    });

    it('shows "Your pay for this job is being recorded." when payAmount is null', async () => {
      (useCancelledJobs as jest.Mock).mockReturnValue({
        data: [sampleNotPickedUpJob],
      });

      render(<CancelledJobCard />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('cancelled-job-card')).toBeTruthy();
      });

      expect(
        screen.getByText('Your pay for this job is being recorded.'),
      ).toBeTruthy();
    });
  });

  describe('Picked up cancellation food outcome (AC-8)', () => {
    it('Food returned calls sendFoodOutcome with RETURNED and no note, then refreshes query', async () => {
      (useCancelledJobs as jest.Mock).mockReturnValue({
        data: [samplePickedUpJob],
      });
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      render(<CancelledJobCard />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('cancelled-job-card')).toBeTruthy();
      });

      const returnedButton = screen.getByText(
        i18n.t('translations:cancelled_food_returned'),
      );
      await act(async () => {
        fireEvent.press(returnedButton);
      });

      expect(sendFoodOutcome).toHaveBeenCalledWith(
        'del-picked-up-1',
        'RETURNED',
        undefined,
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.cancelledJobs],
      });
    });

    it("Couldn't return it shows note input, disables Send while empty, and sends with note on submit", async () => {
      (useCancelledJobs as jest.Mock).mockReturnValue({
        data: [samplePickedUpJob],
      });
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      render(<CancelledJobCard />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('cancelled-job-card')).toBeTruthy();
      });

      // Tap Couldn't return it
      const notReturnedButton = screen.getByText(
        i18n.t('translations:cancelled_food_not_returned'),
      );
      fireEvent.press(notReturnedButton);

      // Note input should be present
      const noteInput = screen.getByPlaceholderText(
        i18n.t('translations:cancelled_note_placeholder'),
      );
      expect(noteInput).toBeTruthy();

      // Send button should be disabled when note is empty
      const sendButton = screen.getByText(
        i18n.t('translations:cancelled_note_send'),
      );
      // Pressing while disabled should not trigger send
      fireEvent.press(sendButton);
      expect(sendFoodOutcome).not.toHaveBeenCalled();

      // Type whitespace only -> still disabled
      fireEvent.changeText(noteInput, '   ');
      fireEvent.press(sendButton);
      expect(sendFoodOutcome).not.toHaveBeenCalled();

      // Type actual explanation
      fireEvent.changeText(
        noteInput,
        'Restaurant had already closed for the night',
      );
      await act(async () => {
        fireEvent.press(sendButton);
      });

      expect(sendFoodOutcome).toHaveBeenCalledWith(
        'del-picked-up-1',
        'NOT_RETURNED',
        'Restaurant had already closed for the night',
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.cancelledJobs],
      });
    });

    it('Back button in note view returns to outcome buttons without submitting', async () => {
      (useCancelledJobs as jest.Mock).mockReturnValue({
        data: [samplePickedUpJob],
      });

      render(<CancelledJobCard />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('cancelled-job-card')).toBeTruthy();
      });

      fireEvent.press(
        screen.getByText(i18n.t('translations:cancelled_food_not_returned')),
      );
      expect(
        screen.getByPlaceholderText(
          i18n.t('translations:cancelled_note_placeholder'),
        ),
      ).toBeTruthy();

      // Tap Back
      fireEvent.press(screen.getByText(i18n.t('translations:cancelled_back')));

      // Choice buttons restored
      expect(
        screen.getByText(i18n.t('translations:cancelled_food_returned')),
      ).toBeTruthy();
      expect(sendFoodOutcome).not.toHaveBeenCalled();
    });

    it('refreshes cancelledJobs without showing error text on 409 conflict', async () => {
      (useCancelledJobs as jest.Mock).mockReturnValue({
        data: [samplePickedUpJob],
      });
      const error409: any = new Error('Already recorded');
      error409.response = { status: 409 };
      (sendFoodOutcome as jest.Mock).mockRejectedValueOnce(error409);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      render(<CancelledJobCard />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('cancelled-job-card')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:cancelled_food_returned')),
        );
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.cancelledJobs],
      });
      expect(
        screen.queryByText(i18n.t('translations:cancelled_send_failed')),
      ).toBeNull();
    });

    it('shows error text on other send failure (e.g. 500 or network)', async () => {
      (useCancelledJobs as jest.Mock).mockReturnValue({
        data: [samplePickedUpJob],
      });
      (sendFoodOutcome as jest.Mock).mockRejectedValueOnce(
        new Error('Network error'),
      );

      render(<CancelledJobCard />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('cancelled-job-card')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(
          screen.getByText(i18n.t('translations:cancelled_food_returned')),
        );
      });

      expect(
        screen.getByText(i18n.t('translations:cancelled_send_failed')),
      ).toBeTruthy();
    });
  });

  describe('Not picked up cancellation flow (AC-7, AC-12)', () => {
    it('shows do not collect text, and OK button acknowledges and hides the card', async () => {
      (useCancelledJobs as jest.Mock).mockReturnValue({
        data: [sampleNotPickedUpJob],
      });

      render(<CancelledJobCard />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('cancelled-job-card')).toBeTruthy();
      });

      expect(
        screen.getByText('You had not picked it up: do not collect it.'),
      ).toBeTruthy();

      const okButton = screen.getByText(i18n.t('translations:cancelled_ok'));
      expect(okButton).toBeTruthy();

      await act(async () => {
        fireEvent.press(okButton);
      });

      expect(acknowledgeJob).toHaveBeenCalledWith('del-pre-pickup-2');
      // Card hides after acknowledgement
      expect(screen.queryByTestId('cancelled-job-card')).toBeNull();
    });
  });

  describe('Decision 32.16 (96eebae): Later button and Android back button', () => {
    it('sets picked up card aside with Later button, shows banner on Home, and tapping banner reopens card without sending', async () => {
      (useCancelledJobs as jest.Mock).mockReturnValue({
        data: [samplePickedUpJob],
      });

      render(<CancelledJobCard />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('cancelled-job-card')).toBeTruthy();
      });

      // Tap Later
      const laterButton = screen.getByText(
        i18n.t('translations:cancelled_later'),
      );
      fireEvent.press(laterButton);

      // Card modal is gone, banner is shown instead
      expect(screen.queryByTestId('cancelled-job-card')).toBeNull();
      const banner = screen.getByTestId('cancelled-job-banner');
      expect(banner).toBeTruthy();
      expect(
        screen.getByText('Bring the food back to Ouzeri Volos, then tap here.'),
      ).toBeTruthy();

      // Later records nothing (no POST, no acknowledge)
      expect(sendFoodOutcome).not.toHaveBeenCalled();
      expect(acknowledgeJob).not.toHaveBeenCalled();

      // Tap banner to bring card back
      fireEvent.press(banner);
      expect(screen.getByTestId('cancelled-job-card')).toBeTruthy();
      expect(screen.queryByTestId('cancelled-job-banner')).toBeNull();
    });

    it('Android back button (Modal onRequestClose) also sets card aside with banner', async () => {
      (useCancelledJobs as jest.Mock).mockReturnValue({
        data: [sampleNotPickedUpJob],
      });

      const { UNSAFE_getByType } = render(<CancelledJobCard />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByTestId('cancelled-job-card')).toBeTruthy();
      });

      // Trigger Modal onRequestClose
      const modal = UNSAFE_getByType('Modal' as any);
      act(() => {
        modal.props.onRequestClose();
      });

      expect(screen.queryByTestId('cancelled-job-card')).toBeNull();
      const banner = screen.getByTestId('cancelled-job-banner');
      expect(banner).toBeTruthy();
      expect(screen.getByText('Tap here to see it.')).toBeTruthy();

      expect(acknowledgeJob).not.toHaveBeenCalled();
    });
  });

  it('passes inFront prop to useCancelledJobs', () => {
    (useCancelledJobs as jest.Mock).mockReturnValue({ data: [] });

    render(<CancelledJobCard inFront={false} />, { wrapper: createWrapper() });
    expect(useCancelledJobs).toHaveBeenCalledWith(false);
  });
});
