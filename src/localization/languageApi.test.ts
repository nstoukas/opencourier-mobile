import i18n from 'i18next';
import { client } from '@app/services/Client';
import { chooseLanguage, currentLanguage } from './appLanguage';
import { putCourierLanguage, sendLanguageToServer } from './languageApi';

describe('languageApi (spec 0054 AC-1, decision 47.34)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('en');
  });

  describe('putCourierLanguage', () => {
    it('sends PUT courier/language with { language }', async () => {
      const putSpy = jest.spyOn(client, 'put').mockResolvedValueOnce({} as any);

      await putCourierLanguage('el');

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith('courier/language', {
        language: 'el',
      });
    });

    it('propagates rejection when network fails', async () => {
      jest
        .spyOn(client, 'put')
        .mockRejectedValueOnce(new Error('Network disconnected'));

      await expect(putCourierLanguage('en')).rejects.toThrow(
        'Network disconnected',
      );
    });
  });

  describe('sendLanguageToServer', () => {
    it('sends currentLanguage() to server without throwing on rejection when Greek is chosen', async () => {
      await chooseLanguage('el');
      expect(currentLanguage()).toBe('el');

      const putSpy = jest
        .spyOn(client, 'put')
        .mockRejectedValueOnce(new Error('Failed silently'));
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Must not throw
      expect(() => sendLanguageToServer()).not.toThrow();

      // Verify put called with current language (el)
      expect(putSpy).toHaveBeenCalledWith('courier/language', {
        language: 'el',
      });

      consoleSpy.mockRestore();
    });

    it('sends English ("en") to server when English is chosen (catches hardcoded "el")', async () => {
      await chooseLanguage('en');
      expect(currentLanguage()).toBe('en');

      const putSpy = jest.spyOn(client, 'put').mockResolvedValueOnce({} as any);

      sendLanguageToServer();

      // Verify put called with current language (en)
      expect(putSpy).toHaveBeenCalledWith('courier/language', {
        language: 'en',
      });
    });
  });
});
