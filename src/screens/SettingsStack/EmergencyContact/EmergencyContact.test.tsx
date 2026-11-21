import React from 'react';
import { Alert } from 'react-native';
import {
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

  it('on success says it is saved and that the co-op sees it on an SOS, then goes back', async () => {
    renderScreen();
    await loaded('Maria Rider', '+306922222222');

    fireEvent(saveButton(), 'press');

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
    expect(alertSpy).toHaveBeenCalledWith(
      'Saved. The co-op sees it if you send an SOS.',
    );
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
});
