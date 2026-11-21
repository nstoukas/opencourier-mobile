import React from 'react';
import { Alert } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import i18n from '@app/localization/i18n';
import { Button } from '@app/components/Button/Button';
import {
  fetchEmergencyContact,
  saveEmergencyContact,
} from '@app/services/account/accountApi';
import { EmergencyContact } from './EmergencyContact';

jest.mock('@app/services/account/accountApi', () => ({
  fetchEmergencyContact: jest.fn(),
  saveEmergencyContact: jest.fn(),
}));

const mockFetch = fetchEmergencyContact as jest.Mock;
const mockSave = saveEmergencyContact as jest.Mock;

// Spec 0051 (AC-4, cross check 12): the rider's emergency contact is kept on the server. The screen loads
// the stored name and phone and saves both there.
describe('EmergencyContact screen (spec 0051, AC-4, cross check 12)', () => {
  let alertSpy: jest.SpyInstance;
  const navigation: any = { goBack: jest.fn() };

  const nameBox = () =>
    screen.getByPlaceholderText(i18n.t('translations:emergency_contact_name'));
  const phoneBox = () =>
    screen.getByPlaceholderText(i18n.t('translations:emergency_contact_phone'));
  const saveButton = () => screen.UNSAFE_getByType(Button);
  const renderScreen = () =>
    render(<EmergencyContact navigation={navigation} route={{} as any} />);
  const loaded = async (name: string, phone: string) => {
    await waitFor(() => {
      expect(nameBox().props.value).toBe(name);
      expect(phoneBox().props.value).toBe(phone);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      name: 'Maria Rider',
      phone: '+306922222222',
    });
    mockSave.mockImplementation(async contact => contact);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('loads the name and phone stored on the server into the two boxes', async () => {
    renderScreen();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    await loaded('Maria Rider', '+306922222222');
  });

  it('a rider with none stored sees two empty boxes, not "null"', async () => {
    mockFetch.mockResolvedValue({ name: null, phone: null });

    renderScreen();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    await loaded('', '');
  });

  it('saves the name and the phone the rider typed, trimmed, to the server', async () => {
    renderScreen();
    await loaded('Maria Rider', '+306922222222');

    fireEvent.changeText(nameBox(), '  Eleni Rider ');
    fireEvent.changeText(phoneBox(), ' +306933333333 ');
    fireEvent(saveButton(), 'press');

    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave).toHaveBeenCalledWith({
      name: 'Eleni Rider',
      phone: '+306933333333',
    });
  });

  it('saving what was loaded sends both parts back unchanged', async () => {
    renderScreen();
    await loaded('Maria Rider', '+306922222222');

    fireEvent(saveButton(), 'press');

    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave).toHaveBeenCalledWith({
      name: 'Maria Rider',
      phone: '+306922222222',
    });
  });

  it('an emptied box is saved as null: both parts are optional', async () => {
    renderScreen();
    await loaded('Maria Rider', '+306922222222');

    fireEvent.changeText(nameBox(), '   ');
    fireEvent.changeText(phoneBox(), '');
    fireEvent(saveButton(), 'press');

    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave).toHaveBeenCalledWith({ name: null, phone: null });
  });

  // Row 108 review (ruling: "The co-op sees it if you send an SOS"): the SOS screen does not show the
  // contact yet (decision 108.5), so the sentence says only that the co-op can see it.
  it('on success says it is saved and that the co-op can see it, promising nothing about an SOS, then goes back', async () => {
    renderScreen();
    await loaded('Maria Rider', '+306922222222');

    fireEvent(saveButton(), 'press');

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Saved. The co-op can see it.');
    expect(String(alertSpy.mock.calls[0][0])).not.toMatch(/SOS/i);
  });

  it('when the save fails, says so in words and stays, keeping what was typed', async () => {
    mockSave.mockRejectedValue(new Error('Network Error'));
    renderScreen();
    await loaded('Maria Rider', '+306922222222');
    fireEvent.changeText(nameBox(), 'Eleni Rider');

    fireEvent(saveButton(), 'press');

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Could not save. Try again.'),
    );
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(nameBox().props.value).toBe('Eleni Rider');
    // The rider can try again.
    await waitFor(() => expect(saveButton().props.disabled).toBe(false));
  });

  it('the boxes take what the server takes: a name up to 120 characters, a phone up to 32', async () => {
    renderScreen();
    await loaded('Maria Rider', '+306922222222');

    expect(nameBox().props.maxLength).toBe(120);
    expect(phoneBox().props.maxLength).toBe(32);
  });

  // Row 108 review (ruling: "Save can blank a stored contact"): the boxes start empty, so a Save pressed
  // before the stored contact arrived, or after it failed to arrive, would write blanks over it. Save stays
  // off until the load succeeds; a failed load says so and is tried again on a tap.
  describe('Save waits for the stored contact (row 108 review)', () => {
    const LOAD_FAILED = 'Could not load your contact. Tap here to try again.';
    // A load the test finishes by hand.
    const pendingLoad = () => {
      let resolve!: (contact: {
        name: string | null;
        phone: string | null;
      }) => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<{
        name: string | null;
        phone: string | null;
      }>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
    // The button as the rider's finger meets it: a disabled one takes no press.
    const pressSave = () =>
      fireEvent.press(screen.getByText(i18n.t('translations:save')));

    it('Save is off while the contact is loading, and on once it has loaded', async () => {
      const load = pendingLoad();
      mockFetch.mockReturnValue(load.promise);

      renderScreen();

      expect(saveButton().props.disabled).toBe(true);
      pressSave();
      expect(mockSave).not.toHaveBeenCalled();
      expect(screen.queryByText(LOAD_FAILED)).toBeNull();

      await act(async () => {
        load.resolve({ name: 'Maria Rider', phone: '+306922222222' });
      });

      await loaded('Maria Rider', '+306922222222');
      expect(saveButton().props.disabled).toBe(false);
    });

    it('a rider with no contact stored can save once that (empty) answer has loaded', async () => {
      mockFetch.mockResolvedValue({ name: null, phone: null });

      renderScreen();

      await waitFor(() => expect(saveButton().props.disabled).toBe(false));
      expect(screen.queryByText(LOAD_FAILED)).toBeNull();
    });

    it('a load that succeeds shows no "could not load" line', async () => {
      renderScreen();
      await loaded('Maria Rider', '+306922222222');

      expect(screen.queryByText(LOAD_FAILED)).toBeNull();
    });

    it('a failed load says so in words, keeps Save off, and never sends the empty boxes', async () => {
      mockFetch.mockRejectedValue(new Error('Network Error'));

      renderScreen();

      const line = await screen.findByText(LOAD_FAILED);
      expect(line.props.accessibilityRole).toBe('alert');
      expect(saveButton().props.disabled).toBe(true);

      pressSave();
      pressSave();
      // Give a save that should never start the time to start.
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockSave).not.toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();
      expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('typing after a failed load still does not let blanks or a half filled form be saved', async () => {
      mockFetch.mockRejectedValue(new Error('Network Error'));
      renderScreen();
      await screen.findByText(LOAD_FAILED);

      fireEvent.changeText(nameBox(), 'Eleni Rider');
      pressSave();

      expect(saveButton().props.disabled).toBe(true);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('tapping the line tries the load again: the line goes, Save stays off until it answers, then the stored contact fills the boxes', async () => {
      const second = pendingLoad();
      mockFetch
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockReturnValueOnce(second.promise);
      renderScreen();

      fireEvent.press(await screen.findByText(LOAD_FAILED));

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(screen.queryByText(LOAD_FAILED)).toBeNull();
      expect(saveButton().props.disabled).toBe(true);

      await act(async () => {
        second.resolve({ name: 'Maria Rider', phone: '+306922222222' });
      });

      await loaded('Maria Rider', '+306922222222');
      expect(saveButton().props.disabled).toBe(false);
      expect(screen.queryByText(LOAD_FAILED)).toBeNull();

      pressSave();
      await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
      expect(mockSave).toHaveBeenCalledWith({
        name: 'Maria Rider',
        phone: '+306922222222',
      });
    });

    it('a retry that fails too shows the line again and keeps Save off', async () => {
      mockFetch.mockRejectedValue(new Error('Network Error'));
      renderScreen();

      fireEvent.press(await screen.findByText(LOAD_FAILED));

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
      expect(await screen.findByText(LOAD_FAILED)).toBeTruthy();
      expect(saveButton().props.disabled).toBe(true);
      pressSave();
      expect(mockSave).not.toHaveBeenCalled();
    });
  });
});
