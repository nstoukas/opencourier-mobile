import i18n from 'i18next';
import { AxiosError } from 'axios';
import {
  dayText,
  hasServerText,
  refusalText,
  renderServerText,
  whenText,
} from './serverText';
import {
  serverMessage,
  serverCode,
  serverSentence,
} from '@app/hooks/useMoveDropoffPin';
import { serverSentenceOf } from '@app/services/orderService';
import { setAppLocale } from '@app/utilities/locale';

describe('serverText (spec 0054, AC-4, AC-6, decisions 47.31, 47.35, 47.46)', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
    setAppLocale('en');
  });

  describe('hasServerText', () => {
    it('returns true for known server keys and false for unknown', () => {
      expect(hasServerText('server.error.ORDER_CHANGED')).toBe(true);
      expect(hasServerText('server.error.SHIFT_FULL')).toBe(true);
      expect(hasServerText('server.error.NON_EXISTENT_ERROR')).toBe(false);
    });
  });

  describe('renderServerText', () => {
    it('renders server refusal template in English when language is en', async () => {
      await i18n.changeLanguage('en');
      setAppLocale('en');

      const rendered = renderServerText('server.error.ORDER_CHANGED');
      expect(rendered).toBe('This order changed. Check your jobs.');
    });

    it('renders server refusal template in Greek when language is el', async () => {
      await i18n.changeLanguage('el');
      setAppLocale('el');

      const rendered = renderServerText('server.error.ORDER_CHANGED');
      expect(rendered).toBe('Η παραγγελία άλλαξε. Ελέγξτε τις δουλειές σας.');
    });

    it('falls back to English when code is missing from Greek templates (spec 0054, AC-6)', async () => {
      await i18n.changeLanguage('el');
      setAppLocale('el');

      // Add a server error key that exists ONLY in English, missing from Greek
      i18n.addResource(
        'en',
        'server',
        'error.CODE_MISSING_IN_GREEK',
        'English server message for new un-translated error code',
      );

      const rendered = renderServerText('server.error.CODE_MISSING_IN_GREEK');
      expect(rendered).toBe(
        'English server message for new un-translated error code',
      );
    });

    it('interpolates params into templates (e.g. minutes, boxUnits)', async () => {
      await i18n.changeLanguage('en');
      setAppLocale('en');

      const rendered = renderServerText('server.error.LEAVE_WAIT_TOO_SOON', {
        minutes: 10,
      });
      expect(rendered).toContain('10 min');

      await i18n.changeLanguage('el');
      setAppLocale('el');

      const renderedEl = renderServerText('server.error.LEAVE_WAIT_TOO_SOON', {
        minutes: 10,
      });
      expect(renderedEl).toContain('10 λεπτά');
    });

    it('formats clock parameter with HH:mm in Athens timezone', async () => {
      await i18n.changeLanguage('en');
      setAppLocale('en');

      // 12:30 UTC is 14:30 in Athens (UTC+2)
      const rendered = renderServerText('server.error.SHIFT_DROP_TOO_LATE', {
        until: '2026-11-20T12:30:00Z',
      });
      expect(rendered).toContain('14:30');
    });

    it('formats money and decimal with language decimal mark', async () => {
      await i18n.changeLanguage('el');
      setAppLocale('el');

      // In Greek, 350 cents is 3,50 €
      const rendered = renderServerText(
        'server.event.PARTNER_CHARGED_FOR_SPLIT',
        {
          amount: 350,
          currency: 'EUR',
          splitId: 'split-1',
        },
      );
      expect(rendered).toMatch(/3,50[\s\u00A0]€/);

      await i18n.changeLanguage('en');
      setAppLocale('en');

      const renderedEn = renderServerText(
        'server.event.PARTNER_CHARGED_FOR_SPLIT',
        {
          amount: 350,
          currency: 'EUR',
          splitId: 'split-1',
        },
      );
      expect(renderedEn).toContain('350 EUR');
    });

    it('returns the raw key when template is not found in either language', () => {
      expect(renderServerText('server.unknown.key')).toBe('server.unknown.key');
    });
  });

  describe('refusalText', () => {
    it('returns undefined when refusal is undefined or null', () => {
      expect(refusalText(undefined)).toBeUndefined();
      expect(refusalText(null as any)).toBeUndefined();
    });

    it('renders translated text for known error code with params', async () => {
      await i18n.changeLanguage('el');
      setAppLocale('el');

      const text = refusalText({
        code: 'LEAVE_WAIT_TOO_SOON',
        params: { minutes: 15 },
        message: 'Leave wait too soon English fallback',
      });

      expect(text).toContain('15 λεπτά');
    });

    it('falls back to server message when code is unknown', async () => {
      await i18n.changeLanguage('el');
      setAppLocale('el');

      const text = refusalText({
        code: 'SOME_NEW_UNCODED_ERROR',
        message: 'Direct server English sentence',
      });

      expect(text).toBe('Direct server English sentence');
    });

    it('returns undefined when refusal has unknown code and no message', () => {
      expect(refusalText({ code: 'UNKNOWN_EMPTY' })).toBeUndefined();
      expect(
        refusalText({ code: 'UNKNOWN_EMPTY', message: '   ' }),
      ).toBeUndefined();
    });
  });

  describe('serverMessage, serverCode, serverSentence and serverSentenceOf', () => {
    const makeError = (status: number, data: unknown): AxiosError => {
      const err = new AxiosError('Request failed');
      err.response = {
        status,
        statusText: 'Error',
        headers: {},
        config: {} as any,
        data,
      };
      return err;
    };

    it('serverMessage extracts and translates 4xx refusal by code in rider language', async () => {
      await i18n.changeLanguage('el');
      setAppLocale('el');

      const error = makeError(409, {
        result: [{ code: 'ORDER_CHANGED', message: 'Order changed' }],
      });

      expect(serverMessage(error)).toBe(
        'Η παραγγελία άλλαξε. Ελέγξτε τις δουλειές σας.',
      );
      expect(serverCode(error)).toBe('ORDER_CHANGED');
      expect(serverSentence(error)).toBe('Order changed');
    });

    it('serverMessage returns undefined for 500 errors', () => {
      const error500 = makeError(500, {
        result: [{ code: 'ORDER_CHANGED', message: 'Server crash' }],
      });

      expect(serverMessage(error500)).toBeUndefined();
      expect(serverCode(error500)).toBeUndefined();
    });

    it('serverSentenceOf extracts 409 refusal translated sentence', async () => {
      await i18n.changeLanguage('en');
      setAppLocale('en');

      const error = makeError(409, {
        result: [{ code: 'STACK_CHANGED' }],
      });

      expect(serverSentenceOf(error)).toBe(
        'One order of this pair changed before your answer arrived, so nothing was accepted. Check your offers again.',
      );
    });

    it('serverSentenceOf returns null for non-409 errors', () => {
      const error404 = makeError(404, {
        result: [{ code: 'STACK_CHANGED' }],
      });
      expect(serverSentenceOf(error404)).toBeNull();
    });
  });

  describe('dayText and whenText', () => {
    it('dayText returns "today" / "σήμερα" for timestamps today', () => {
      const now = Date.now();
      expect(dayText(now, 'en')).toBe('today');
      expect(dayText(now, 'el')).toBe('σήμερα');
    });

    it('dayText returns "tomorrow" / "αύριο" for timestamps tomorrow', () => {
      const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
      expect(dayText(tomorrow, 'en')).toBe('tomorrow');
      expect(dayText(tomorrow, 'el')).toBe('αύριο');
    });

    it('whenText returns just HH:mm when time is today', () => {
      const now = Date.now();
      const text = whenText(now, 'en');
      expect(text).toMatch(/^\d{2}:\d{2}$/);
      expect(text).not.toContain('today');
    });

    it('whenText appends day when time is not today', () => {
      const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
      const text = whenText(tomorrow, 'en');
      expect(text).toMatch(/^\d{2}:\d{2} tomorrow$/);
    });
  });
});
