import React from 'react';
import { Alert, KeyboardAvoidingView } from 'react-native';
import {
  render,
  fireEvent,
  act,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  hasSeenAddressNotesRules,
  markAddressNotesRulesSeen,
} from '@app/services/addressNotesRules';
import { PERSONAL_DATA_WARNING_CODE } from '@app/hooks/useAddressNotes';
import { Note } from '@app/types/types';
import { ADDRESS_NOTE_MAX_LENGTH, AddNote } from './AddNote';

// Mock addressNotesRules service
jest.mock('@app/services/addressNotesRules', () => ({
  hasSeenAddressNotesRules: jest.fn(),
  markAddressNotesRulesSeen: jest.fn().mockResolvedValue(undefined),
}));

// Mock services
jest.mock('@app/services/service', () => ({
  services: {
    commentService: {
      createComment: jest.fn(),
      updateComment: jest.fn(),
    },
  },
}));

// Mock useJobContact
jest.mock('@app/hooks/useJobContact', () => ({
  useJobContact: () => ({
    data: { addressNoteRetentionDays: 182 },
  }),
}));

describe('AddNote screen (spec 0053, AC-2, AC-4, AC-8)', () => {
  let queryClient: QueryClient;
  let invalidateSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;

  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const createWrapper = () => {
    // Row 158: gcTime Infinity, so no garbage collection timer outlives the test and the Jest worker can exit.
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
    invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  const buildProps = (
    params: any = { deliveryId: 'del-101', stop: 'DROPOFF' },
  ): any => ({
    navigation: mockNavigation,
    route: {
      params,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (hasSeenAddressNotesRules as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  describe('First-time rules notice (AC-8)', () => {
    it('shows the rules notice before the input the first time a rider adds a note on this phone', async () => {
      (hasSeenAddressNotesRules as jest.Mock).mockResolvedValue(false);

      render(<AddNote {...buildProps()} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(
          screen.getByText(i18n.t('translations:address_note_rules_title')),
        ).toBeTruthy();
        expect(screen.getByTestId('address-notes-rules')).toBeTruthy();
      });

      // Pressing "Got it" marks rules as seen and switches to the input
      const gotItButton = screen.getByText(
        i18n.t('translations:address_note_rules_ok'),
      );
      await act(async () => {
        fireEvent.press(gotItButton);
      });

      expect(markAddressNotesRulesSeen).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('address-note-input')).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:address_note_title')),
      ).toBeTruthy();
    });

    it('renders input directly if the rider has already seen the rules', async () => {
      (hasSeenAddressNotesRules as jest.Mock).mockResolvedValue(true);

      render(<AddNote {...buildProps()} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('address-note-input')).toBeTruthy();
      });

      expect(screen.queryByTestId('address-notes-rules')).toBeNull();
    });

    it('skips the rules check when editing an existing note (noteToEdit provided)', () => {
      (hasSeenAddressNotesRules as jest.Mock).mockResolvedValue(false);

      const noteToEdit: Note = {
        id: 'note-edit-1',
        note: 'Dog in garden',
        upvotes: 2,
        upvotedByMe: false,
        flaggedByMe: false,
        mine: true,
      };

      render(<AddNote {...buildProps({ noteToEdit })} />, {
        wrapper: createWrapper(),
      });

      // Rules are not shown, input is prepopulated with existing note
      expect(screen.queryByTestId('address-notes-rules')).toBeNull();
      expect(screen.getByTestId('address-note-input')).toBeTruthy();
      expect(screen.getByDisplayValue('Dog in garden')).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:address_note_title_edit')),
      ).toBeTruthy();
    });
  });

  describe('Input validation and constraints (AC-2)', () => {
    it('disables Save button when input is empty or whitespace only', async () => {
      render(<AddNote {...buildProps()} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('address-note-input')).toBeTruthy();
      });

      const getSaveButton = () =>
        screen.UNSAFE_getByProps({
          title: i18n.t('translations:save'),
        });

      // Initially empty: Save is disabled
      expect(getSaveButton().props.disabled).toBe(true);

      // Typing spaces only keeps it disabled
      fireEvent.changeText(screen.getByTestId('address-note-input'), '     ');
      expect(getSaveButton().props.disabled).toBe(true);

      // Typing valid text enables Save
      fireEvent.changeText(
        screen.getByTestId('address-note-input'),
        'Ring bell 4',
      );
      expect(getSaveButton().props.disabled).toBe(false);
    });

    it('enforces ADDRESS_NOTE_MAX_LENGTH (255 characters)', async () => {
      render(<AddNote {...buildProps()} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('address-note-input')).toBeTruthy();
      });

      const input = screen.getByTestId('address-note-input');
      expect(input.props.maxLength).toBe(ADDRESS_NOTE_MAX_LENGTH);
      expect(ADDRESS_NOTE_MAX_LENGTH).toBe(255);
    });
  });

  describe('Saving a safe note (Happy path, AC-2)', () => {
    it('creates note and goes back when note does not look like personal data', async () => {
      (
        services.commentService.createComment as jest.Mock
      ).mockResolvedValueOnce({
        error: false,
      });

      render(
        <AddNote
          {...buildProps({ deliveryId: 'del-drop-42', stop: 'DROPOFF' })}
        />,
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(screen.getByTestId('address-note-input')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByTestId('address-note-input'),
        '  Entrance is behind the bakery  ',
      );

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:save')));
      });

      expect(services.commentService.createComment).toHaveBeenCalledTimes(1);
      expect(services.commentService.createComment).toHaveBeenCalledWith({
        deliveryId: 'del-drop-42',
        stop: 'DROPOFF',
        note: 'Entrance is behind the bakery',
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('creates pickup note on restaurant stop', async () => {
      (
        services.commentService.createComment as jest.Mock
      ).mockResolvedValueOnce({
        error: false,
      });

      render(
        <AddNote
          {...buildProps({ deliveryId: 'del-pick-1', stop: 'PICKUP' })}
        />,
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(screen.getByTestId('address-note-input')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByTestId('address-note-input'),
        'Pick up at back kitchen door',
      );

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:save')));
      });

      expect(services.commentService.createComment).toHaveBeenCalledWith({
        deliveryId: 'del-pick-1',
        stop: 'PICKUP',
        note: 'Pick up at back kitchen door',
      });
    });
  });

  describe('Personal data warnings (AC-4, AC-9)', () => {
    it('shows warning alert and allows editing or saving anyway when text looks like a phone number', async () => {
      (
        services.commentService.createComment as jest.Mock
      ).mockResolvedValueOnce({
        error: false,
      });

      render(<AddNote {...buildProps()} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('address-note-input')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByTestId('address-note-input'),
        'Call 6912345678 upon arrival',
      );

      // Press Save
      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:save')));
      });

      // Does NOT call createComment directly
      expect(services.commentService.createComment).not.toHaveBeenCalled();

      // Warning alert is shown
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_warning_title'),
        i18n.t('translations:address_note_warning'),
        expect.any(Array),
      );

      const alertButtons = alertSpy.mock.calls[0][2];
      const editOption = alertButtons.find(
        (b: any) => b.text === i18n.t('translations:address_note_warning_edit'),
      );
      const saveAnywayOption = alertButtons.find(
        (b: any) => b.text === i18n.t('translations:address_note_warning_save'),
      );

      expect(editOption).toBeTruthy();
      expect(saveAnywayOption).toBeTruthy();

      // Choosing Save anyway sends request with confirmed: true
      await act(async () => {
        await saveAnywayOption.onPress();
      });

      expect(services.commentService.createComment).toHaveBeenCalledWith({
        deliveryId: 'del-101',
        stop: 'DROPOFF',
        note: 'Call 6912345678 upon arrival',
        confirmed: true,
      });
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('shows warning alert when text contains a name (e.g. Maria)', async () => {
      render(<AddNote {...buildProps()} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('address-note-input')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByTestId('address-note-input'),
        'Key is with Maria on 2nd floor',
      );

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:save')));
      });

      expect(services.commentService.createComment).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_warning_title'),
        expect.any(String),
        expect.any(Array),
      );
    });

    it('handles server 422 PERSONAL_DATA_WARNING by showing warning dialog and allowing Save anyway', async () => {
      const warningError = new AxiosError('Unprocessable Entity');
      warningError.response = {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: {},
        config: {} as any,
        data: {
          error: true,
          result: [
            {
              code: PERSONAL_DATA_WARNING_CODE,
              message: 'Name detected by server',
              statusCode: 422,
            },
          ],
        },
      };

      (services.commentService.createComment as jest.Mock)
        .mockRejectedValueOnce(warningError)
        .mockResolvedValueOnce({ error: false });

      render(<AddNote {...buildProps()} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('address-note-input')).toBeTruthy();
      });

      // Type text that passed client check (e.g. new name server has)
      fireEvent.changeText(
        screen.getByTestId('address-note-input'),
        'Some entrance detail',
      );

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:save')));
      });

      // First attempt without confirmed: false
      expect(services.commentService.createComment).toHaveBeenCalledWith({
        deliveryId: 'del-101',
        stop: 'DROPOFF',
        note: 'Some entrance detail',
      });

      // Warning alert is presented from server response
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_warning_title'),
        i18n.t('translations:address_note_warning'),
        expect.any(Array),
      );

      const alertButtons = alertSpy.mock.calls[0][2];
      const saveAnywayOption = alertButtons.find(
        (b: any) => b.text === i18n.t('translations:address_note_warning_save'),
      );

      // Confirm Save anyway
      await act(async () => {
        await saveAnywayOption.onPress();
      });

      expect(services.commentService.createComment).toHaveBeenCalledWith({
        deliveryId: 'del-101',
        stop: 'DROPOFF',
        note: 'Some entrance detail',
        confirmed: true,
      });
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Editing existing note (AC-4, cross check 7)', () => {
    it('updates note and reruns personal data check without confirmed', async () => {
      (
        services.commentService.updateComment as jest.Mock
      ).mockResolvedValueOnce({
        error: false,
      });

      const noteToEdit: Note = {
        id: 'note-to-edit-88',
        note: 'Bell broken',
        upvotes: 0,
        upvotedByMe: false,
        flaggedByMe: false,
        mine: true,
      };

      render(<AddNote {...buildProps({ noteToEdit })} />, {
        wrapper: createWrapper(),
      });

      fireEvent.changeText(
        screen.getByTestId('address-note-input'),
        'Bell broken, knock twice',
      );

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:save')));
      });

      expect(services.commentService.updateComment).toHaveBeenCalledWith({
        id: 'note-to-edit-88',
        note: 'Bell broken, knock twice',
        confirmed: false,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling (Failure cases)', () => {
    it('shows error alert on generic server error', async () => {
      (
        services.commentService.createComment as jest.Mock
      ).mockRejectedValueOnce(new Error('Server 500 error'));

      render(<AddNote {...buildProps()} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('address-note-input')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByTestId('address-note-input'),
        'Ring intercom 42',
      );

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:save')));
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_failed_title'),
        i18n.t('translations:address_note_failed_server'),
      );
      // Stays on screen
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });

    it('shows connection error alert when request has no response (network error)', async () => {
      const netError = new AxiosError('Network Error');
      (
        services.commentService.createComment as jest.Mock
      ).mockRejectedValueOnce(netError);

      render(<AddNote {...buildProps()} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('address-note-input')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByTestId('address-note-input'),
        'Ring intercom 42',
      );

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:save')));
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_failed_title'),
        i18n.t('translations:address_note_save_failed'),
      );
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });

    it('shows job gone alert on 404 when creating a new note (job handed back or cancelled)', async () => {
      const error404 = new AxiosError('Not Found');
      error404.response = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
        data: {},
      };
      (
        services.commentService.createComment as jest.Mock
      ).mockRejectedValueOnce(error404);

      render(<AddNote {...buildProps()} />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('address-note-input')).toBeTruthy();
      });

      fireEvent.changeText(
        screen.getByTestId('address-note-input'),
        'Ring intercom 42',
      );

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:save')));
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_failed_title'),
        i18n.t('translations:address_note_job_gone'),
      );
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });

    it('shows note gone alert on 404 when editing an existing note (note deleted meanwhile)', async () => {
      const error404 = new AxiosError('Not Found');
      error404.response = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: {} as any,
        data: {},
      };
      (
        services.commentService.updateComment as jest.Mock
      ).mockRejectedValueOnce(error404);

      const noteToEdit: Note = {
        id: 'note-to-edit-88',
        note: 'Bell broken',
        upvotes: 0,
        upvotedByMe: false,
        flaggedByMe: false,
        mine: true,
      };

      render(<AddNote {...buildProps({ noteToEdit })} />, {
        wrapper: createWrapper(),
      });

      fireEvent.changeText(
        screen.getByTestId('address-note-input'),
        'Bell broken, knock twice',
      );

      await act(async () => {
        fireEvent.press(screen.getByText(i18n.t('translations:save')));
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:address_note_failed_title'),
        i18n.t('translations:address_note_gone'),
      );
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard padding on Android as well as iOS (row 114)', () => {
    it('uses behavior "padding" on KeyboardAvoidingView', async () => {
      const renderResult = render(<AddNote {...buildProps()} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByTestId('address-note-input')).toBeTruthy();
      });

      const kav = renderResult.UNSAFE_getByType(KeyboardAvoidingView);
      expect(kav.props.behavior).toBe('padding');
    });
  });
});
