import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { MarkAsDelivered } from './MarkAsDelivered';
import { CustomerNotes } from '@app/types/types';
import * as jobStepOutbox from '@app/services/jobStepOutbox';
import { services } from '@app/services/service';
import ButtonSwipe from '@app/components/ButtonSwipe/ButtonSwipe';
import i18n from '@app/localization/i18n';

jest.mock('@app/hooks/useUser', () => () => ({
  user: { id: 'test-courier-789' },
}));

describe('MarkAsDelivered (Row 18, Row 20, spec 0018, AC-9)', () => {
  let consoleErrorSpy: jest.SpyInstance;
  const keyWarnings: unknown[][] = [];
  let addJobStepsSpy: jest.SpyInstance;
  let sendJobStepSpy: jest.SpyInstance;

  beforeAll(() => {
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation((...args) => {
        if (
          args.some(
            arg => typeof arg === 'string' && arg.includes('unique "key" prop'),
          )
        ) {
          keyWarnings.push(args);
        }
      });
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  const mockOrder = {
    id: 'test-order-789',
    number: 'ORD-789',
    pickupBusinessName: 'Acropolis Grill',
    pickupName: 'Acropolis Grill',
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
    jobStepOutbox.resetOutboxForTests();
    addJobStepsSpy = jest
      .spyOn(jobStepOutbox, 'addJobSteps')
      .mockResolvedValue(undefined);
    sendJobStepSpy = jest.spyOn(services.orderService, 'sendJobStep');
  });

  afterEach(() => {
    addJobStepsSpy.mockRestore();
    sendJobStepSpy.mockRestore();
  });

  it('renders no "Take a photo" button and no "show the customer" photo line', () => {
    render(<MarkAsDelivered {...defaultProps} />);

    expect(screen.queryByText(/take a photo/i)).toBeNull();
    expect(screen.queryByText(i18n.t('translations:take_a_photo'))).toBeNull();
    expect(screen.queryByText(/show the customer/i)).toBeNull();
    expect(
      screen.queryByText(i18n.t('translations:show_the_customer')),
    ).toBeNull();
    expect(screen.queryByText(/handed to customer/i)).toBeNull();
    expect(
      screen.queryByText(i18n.t('translations:handed_to_customer')),
    ).toBeNull();
  });

  it('renders Delivered swipe and Report issue button', () => {
    const { UNSAFE_getByType } = render(<MarkAsDelivered {...defaultProps} />);

    const swipe = UNSAFE_getByType(ButtonSwipe);
    expect(swipe.props.title).toBe(i18n.t('translations:confirm_mark_as_delivered'));
    expect(screen.getByText(i18n.t('translations:report_issue'))).toBeTruthy();
  });

  it('Delivered swipe with onSwiped(false) does nothing', async () => {
    const { UNSAFE_getByType } = render(<MarkAsDelivered {...defaultProps} />);

    const swipe = UNSAFE_getByType(ButtonSwipe);
    await act(async () => {
      swipe.props.onSwiped(false);
    });

    expect(addJobStepsSpy).not.toHaveBeenCalled();
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('swiping Delivered adds a "delivered" step with empty note and goes back, with no network call', async () => {
    const { UNSAFE_getByType } = render(<MarkAsDelivered {...defaultProps} />);

    const swipe = UNSAFE_getByType(ButtonSwipe);
    await act(async () => {
      await swipe.props.onSwiped(true);
    });

    // 1. Adds 'delivered' step to the outbox
    expect(addJobStepsSpy).toHaveBeenCalledTimes(1);
    const queuedItems = addJobStepsSpy.mock.calls[0][0];
    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0]).toEqual(
      expect.objectContaining({
        courierId: 'test-courier-789',
        deliveryId: 'test-order-789',
        step: 'delivered',
        restaurantName: 'Acropolis Grill',
      }),
    );
    expect(queuedItems[0].note).toBeUndefined();

    // 2. Navigates back immediately
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);

    // 3. No network call made
    expect(sendJobStepSpy).not.toHaveBeenCalled();
  });

  it('swiping Delivered adds a "delivered" step with the selected note and goes back, with no network call', async () => {
    const { UNSAFE_getByType } = render(<MarkAsDelivered {...defaultProps} />);

    // Select the quick note: CustomerNotes.BellnotRung
    const bellNoteText = i18n.t(`translations:${CustomerNotes.BellnotRung}`);
    fireEvent.press(screen.getByText(bellNoteText));

    const swipe = UNSAFE_getByType(ButtonSwipe);
    await act(async () => {
      await swipe.props.onSwiped(true);
    });

    expect(addJobStepsSpy).toHaveBeenCalledTimes(1);
    const queuedItems = addJobStepsSpy.mock.calls[0][0];
    expect(queuedItems).toHaveLength(1);
    expect(queuedItems[0]).toEqual(
      expect.objectContaining({
        courierId: 'test-courier-789',
        deliveryId: 'test-order-789',
        step: 'delivered',
        note: CustomerNotes.BellnotRung,
        restaurantName: 'Acropolis Grill',
      }),
    );

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(sendJobStepSpy).not.toHaveBeenCalled();
  });

  it('draws a fresh swipe with a new key when the delivered step is refused (AC-9)', async () => {
    // Make addJobSteps fail so markAsDelivered returns false
    addJobStepsSpy.mockRejectedValueOnce(new Error('Storage failure'));

    const { UNSAFE_getByType } = render(<MarkAsDelivered {...defaultProps} />);

    const swipeBefore = UNSAFE_getByType(ButtonSwipe);
    expect((swipeBefore as any)._fiber.key).toBe('0');

    await act(async () => {
      await swipeBefore.props.onSwiped(true);
    });

    // Does not go back
    expect(mockNavigation.goBack).not.toHaveBeenCalled();

    // Key increments to '1' so swipe resets to the beginning
    const swipeAfter = UNSAFE_getByType(ButtonSwipe);
    expect((swipeAfter as any)._fiber.key).toBe('1');
  });

  it('renders quick notes with React keys and logs no key warning (Row 66, Clause 6)', () => {
    render(<MarkAsDelivered {...defaultProps} />);
    expect(keyWarnings).toHaveLength(0);
  });
});
