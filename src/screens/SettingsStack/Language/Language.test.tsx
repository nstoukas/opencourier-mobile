import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import i18n from 'i18next';
import { LanguageScreen } from './Language';
import * as appLanguage from '@app/localization/appLanguage';
import * as languageApi from '@app/localization/languageApi';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';

describe('LanguageScreen (spec 0054 AC-1, decisions 47.34, 47.35, row 84)', () => {
  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('en');
  });

  it('renders title, back button, explanation, and available languages', () => {
    render(<LanguageScreen navigation={mockNavigation} route={{} as any} />);

    expect(screen.getByText(i18n.t('translations:language'))).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:language_explained')),
    ).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:language_name_el')),
    ).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:language_name_en')),
    ).toBeTruthy();
  });

  it('navigates back when back button pressed', () => {
    render(<LanguageScreen navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.UNSAFE_getByType(BackNavButton));
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('switching language calls chooseLanguage and putCourierLanguage', async () => {
    const chooseSpy = jest
      .spyOn(appLanguage, 'chooseLanguage')
      .mockResolvedValueOnce();
    const putSpy = jest
      .spyOn(languageApi, 'putCourierLanguage')
      .mockResolvedValueOnce();

    render(<LanguageScreen navigation={mockNavigation} route={{} as any} />);

    // Current is English, tap Ελληνικά
    fireEvent.press(screen.getByText(i18n.t('translations:language_name_el')));

    await waitFor(() => {
      expect(chooseSpy).toHaveBeenCalledWith('el');
      expect(putSpy).toHaveBeenCalledWith('el');
    });
  });

  it('tapping currently selected language does nothing when notSent is false', async () => {
    const chooseSpy = jest.spyOn(appLanguage, 'chooseLanguage');
    const putSpy = jest.spyOn(languageApi, 'putCourierLanguage');

    render(<LanguageScreen navigation={mockNavigation} route={{} as any} />);

    // Current is English, tap English
    fireEvent.press(screen.getByText(i18n.t('translations:language_name_en')));

    expect(chooseSpy).not.toHaveBeenCalled();
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('shows language_not_sent when server update fails, and re-tapping retries sending', async () => {
    jest.spyOn(appLanguage, 'chooseLanguage').mockResolvedValue();
    const putSpy = jest
      .spyOn(languageApi, 'putCourierLanguage')
      .mockRejectedValueOnce(new Error('Server offline'))
      .mockResolvedValueOnce();

    render(<LanguageScreen navigation={mockNavigation} route={{} as any} />);

    // Tap Ελληνικά -> choose succeeds, but putCourierLanguage fails
    fireEvent.press(screen.getByText(i18n.t('translations:language_name_el')));

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('translations:language_not_sent')),
      ).toBeTruthy();
    });

    // Language in component state is now 'el' (or switched in i18n).
    // Now tapping the selected language tries to send to server again!
    fireEvent.press(screen.getByText(i18n.t('translations:language_name_el')));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledTimes(2);
      expect(
        screen.queryByText(i18n.t('translations:language_not_sent')),
      ).toBeNull();
    });
  });
});
