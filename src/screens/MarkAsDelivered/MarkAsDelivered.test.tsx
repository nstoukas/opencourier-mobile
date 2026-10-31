import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { MarkAsDelivered } from './MarkAsDelivered';
import { CustomerNotes } from '@app/types/types';
import * as jobStepOutbox from '@app/services/jobStepOutbox';
import { services } from '@app/services/service';
import i18n from '@app/localization/i18n';

jest.mock('@app/hooks/useUser', () => () => ({
  user: { id: 'test-courier-789' },
}));

describe('MarkAsDelivered (Row 18, no photos; Row 20, bad signal outbox)', () => {
  let consoleErrorSpy: jest.SpyInstance;
  const keyWarnings: unknown[][] = [];
  let addJobStepsSpy: jest.SpyInstance;
  let sendJobStepSpy: jest.SpyInstance;

  // React logs a missing key warning once per component per test file,
  // so the spy is set up before the file's first render.
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

  it('renders Confirm and Report issue buttons', () => {
    render(<MarkAsDelivered {...defaultProps} />);

    expect(
      screen.getByText(i18n.t('translations:confirm_mark_as_delivered')),
    ).toBeTruthy();
    expect(screen.getByText(i18n.t('translations:report_issue'))).toBeTruthy();
  });

  it('pressing Confirm adds a "delivered" step with empty note and goes back, with no network call', async () => {
    render(<MarkAsDelivered {...defaultProps} />);

    await act(async () => {
      fireEvent.press(
        screen.getByText(i18n.t('translations:confirm_mark_as_delivered')),
      );
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

  it('pressing Confirm adds a "delivered" step with the selected note and goes back, with no network call', async () => {
    render(<MarkAsDelivered {...defaultProps} />);

    // Select the quick note: CustomerNotes.BellnotRung
    const bellNoteText = i18n.t(`translations:${CustomerNotes.BellnotRung}`);
    fireEvent.press(screen.getByText(bellNoteText));

    await act(async () => {
      fireEvent.press(
        screen.getByText(i18n.t('translations:confirm_mark_as_delivered')),
      );
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

  it('renders quick notes with React keys and logs no key warning (Row 66, Clause 6)', () => {
    render(<MarkAsDelivered {...defaultProps} />);

    expect(keyWarnings).toHaveLength(0);
  });
});
