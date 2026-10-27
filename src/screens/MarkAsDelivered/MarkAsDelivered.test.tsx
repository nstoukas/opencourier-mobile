import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MarkAsDelivered } from './MarkAsDelivered';
import { CustomerNotes } from '@app/types/types';
import i18n from '@app/localization/i18n';

const mockMutate = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
    useMutation: jest.fn(() => ({
      mutate: mockMutate,
      isPending: false,
    })),
  };
});

describe('MarkAsDelivered (Row 18, no photos)', () => {
  let consoleErrorSpy: jest.SpyInstance;
  const keyWarnings: unknown[][] = [];

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
  });

  it('renders no "Take a photo" button and no "show the customer" photo line', () => {
    render(<MarkAsDelivered {...defaultProps} />);

    // No photo button or photo line
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

  it('pressing Confirm calls the mark as delivered mutation with the order id and empty note when none selected, and nothing about a photo', () => {
    render(<MarkAsDelivered {...defaultProps} />);

    fireEvent.press(
      screen.getByText(i18n.t('translations:confirm_mark_as_delivered')),
    );

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const payload = mockMutate.mock.calls[0][0];
    expect(payload).toEqual({
      id: 'test-order-789',
      note: '',
    });
    expect(payload).not.toHaveProperty('photo');
    expect(payload).not.toHaveProperty('photoUrl');
    expect(payload).not.toHaveProperty('image');
  });

  it('pressing Confirm calls the mutation with the selected note and nothing about a photo', () => {
    render(<MarkAsDelivered {...defaultProps} />);

    // Select the first quick note: CustomerNotes.BellnotRung
    const bellNoteText = i18n.t(`translations:${CustomerNotes.BellnotRung}`);
    fireEvent.press(screen.getByText(bellNoteText));

    fireEvent.press(
      screen.getByText(i18n.t('translations:confirm_mark_as_delivered')),
    );

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const payload = mockMutate.mock.calls[0][0];
    expect(payload).toEqual({
      id: 'test-order-789',
      note: CustomerNotes.BellnotRung,
    });
    expect(payload).not.toHaveProperty('photo');
    expect(payload).not.toHaveProperty('photoUrl');
    expect(payload).not.toHaveProperty('image');
  });

  it('renders quick notes with React keys and logs no key warning (Row 66, Clause 6)', () => {
    render(<MarkAsDelivered {...defaultProps} />);

    expect(keyWarnings).toHaveLength(0);
  });
});
