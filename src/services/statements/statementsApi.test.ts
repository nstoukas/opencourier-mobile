import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform, Share } from 'react-native';
import { client } from '@app/services/Client';
import {
  fetchStatementMonths,
  openStatement,
  statementUrl,
} from './statementsApi';

// Spec 0050 (row 76; AC-1, AC-6, AC-8, cross check 1): the rider's statements. The app asks the months,
// downloads a file with the rider's own login into the cache folder and hands it to the phone.

jest.mock('@app/services/Client', () => ({
  client: { get: jest.fn() },
}));
jest.mock('@app/utilities/config', () => ({
  apiUrl: 'https://coop.example/api/courier/v1',
}));

const mockGet = client.get as jest.Mock;
// The native module is mocked once in jest.setup.js; each test sets what it answers.
const blob = jest.mocked(ReactNativeBlobUtil);
const mockFetch = jest.fn();
const mockView = blob.android.actionViewIntent as jest.Mock;

const answer = (status: number, path = '/cache/statement-2026-10.pdf') => ({
  info: () => ({ status }),
  path: () => path,
});

const setPlatform = (os: 'android' | 'ios') => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
};

describe('statementsApi (spec 0050)', () => {
  const realOs = Platform.OS;
  let share: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({
      data: { error: null, result: { months: [] } },
    });
    mockFetch.mockResolvedValue(answer(200));
    (blob.config as jest.Mock).mockReturnValue({ fetch: mockFetch });
    mockView.mockResolvedValue(undefined);
    share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' } as any);
    await AsyncStorage.setItem('token', 'rider-token-1');
    setPlatform('android');
  });

  afterEach(async () => {
    share.mockRestore();
    await AsyncStorage.clear();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      get: () => realOs,
    });
  });

  describe('fetchStatementMonths (AC-1, AC-8)', () => {
    it("asks GET 'earnings/statements' with no rider id and unwraps the months", async () => {
      mockGet.mockResolvedValue({
        data: { error: null, result: { months: ['2026-10', '2026-09'] } },
      });

      await expect(fetchStatementMonths()).resolves.toEqual([
        '2026-10',
        '2026-09',
      ]);

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledWith('earnings/statements');
    });

    it('an answer with no months is an empty list', async () => {
      mockGet.mockResolvedValue({ data: { error: null, result: null } });

      await expect(fetchStatementMonths()).resolves.toEqual([]);
    });

    it('a failed request throws, so the screen can say it could not load', async () => {
      mockGet.mockRejectedValue(new Error('Network Error'));

      await expect(fetchStatementMonths()).rejects.toThrow('Network Error');
    });
  });

  describe('statementUrl (AC-6, cross check 1)', () => {
    it('is the earnings statement route with the month, the format and the language', () => {
      expect(statementUrl('2026-10', 'pdf', 'el')).toBe(
        'https://coop.example/api/courier/v1/earnings/statements/2026-10?format=pdf&lang=el',
      );
      expect(statementUrl('2026-09', 'csv', 'en')).toBe(
        'https://coop.example/api/courier/v1/earnings/statements/2026-09?format=csv&lang=en',
      );
    });

    it('carries no rider id or name', () => {
      expect(statementUrl('2026-10', 'pdf', 'el')).not.toMatch(
        /courierId|riderId|name=/,
      );
    });

    it('a month can never break out of its place in the path', () => {
      expect(statementUrl('../../admin?x=1', 'pdf', 'el')).toBe(
        'https://coop.example/api/courier/v1/earnings/statements/..%2F..%2Fadmin%3Fx%3D1?format=pdf&lang=el',
      );
    });
  });

  describe('openStatement (cross check 1)', () => {
    it('downloads the file by GET from the statement URL, with the session token as the bearer', async () => {
      await openStatement('2026-10', 'pdf', 'en');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'GET',
        'https://coop.example/api/courier/v1/earnings/statements/2026-10?format=pdf&lang=en',
        { Authorization: 'Bearer rider-token-1' },
      );
    });

    it('the token is in the header, never in the URL', async () => {
      await openStatement('2026-10', 'csv', 'el');

      const [, url] = mockFetch.mock.calls[0];
      expect(url).not.toContain('rider-token-1');
      expect(url).not.toMatch(/token/i);
    });

    it("saves it in the app's cache folder, named for the month and format only", async () => {
      await openStatement('2026-10', 'csv', 'el');

      expect(blob.config).toHaveBeenCalledWith({
        path: '/cache/statement-2026-10.csv',
      });
    });

    it('goes through the usual client first (which renews an expired login), then reads the token', async () => {
      // The renewed token is only there once the list request has answered.
      await AsyncStorage.setItem('token', 'expired-token');
      mockGet.mockImplementation(async () => {
        await AsyncStorage.setItem('token', 'renewed-token');
        return { data: { error: null, result: { months: ['2026-10'] } } };
      });

      await openStatement('2026-10', 'pdf', 'el');

      expect(mockGet).toHaveBeenCalledWith('earnings/statements');
      expect(mockFetch.mock.calls[0][2]).toEqual({
        Authorization: 'Bearer renewed-token',
      });
    });

    it('with no token sends no Authorization header at all (never "Bearer null")', async () => {
      await AsyncStorage.removeItem('token');

      await openStatement('2026-10', 'pdf', 'el');

      expect(mockFetch.mock.calls[0][2]).toEqual({});
    });

    it.each([400, 401, 403, 404, 500])(
      'an answer of %s throws and opens nothing',
      async status => {
        mockFetch.mockResolvedValue(answer(status));

        await expect(openStatement('2026-10', 'pdf', 'el')).rejects.toThrow(
          String(status),
        );
        expect(mockView).not.toHaveBeenCalled();
        expect(share).not.toHaveBeenCalled();
      },
    );

    it('a download that fails on the way throws and opens nothing', async () => {
      mockFetch.mockRejectedValue(new Error('no connection'));

      await expect(openStatement('2026-10', 'pdf', 'el')).rejects.toThrow(
        'no connection',
      );
      expect(mockView).not.toHaveBeenCalled();
      expect(share).not.toHaveBeenCalled();
    });

    it("Android: opens the PDF in the phone's viewer with the PDF mime type", async () => {
      mockFetch.mockResolvedValue(answer(200, '/cache/statement-2026-10.pdf'));

      await openStatement('2026-10', 'pdf', 'el');

      expect(mockView).toHaveBeenCalledTimes(1);
      expect(mockView).toHaveBeenCalledWith(
        '/cache/statement-2026-10.pdf',
        'application/pdf',
      );
      expect(share).not.toHaveBeenCalled();
    });

    it('Android: opens the CSV with the CSV mime type', async () => {
      mockFetch.mockResolvedValue(answer(200, '/cache/statement-2026-10.csv'));

      await openStatement('2026-10', 'csv', 'el');

      expect(mockView).toHaveBeenCalledWith(
        '/cache/statement-2026-10.csv',
        'text/csv',
      );
    });

    it('iOS: opens the share sheet with the downloaded file', async () => {
      setPlatform('ios');
      mockFetch.mockResolvedValue(answer(200, '/cache/statement-2026-10.pdf'));

      await openStatement('2026-10', 'pdf', 'en');

      expect(share).toHaveBeenCalledTimes(1);
      expect(share).toHaveBeenCalledWith({
        url: 'file:///cache/statement-2026-10.pdf',
      });
      expect(mockView).not.toHaveBeenCalled();
    });
  });
});
