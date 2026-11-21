import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform, Share } from 'react-native';
import { client } from '@app/services/Client';
import {
  clearStatementFiles,
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
const mockLs = blob.fs.ls as jest.Mock;
const mockUnlink = blob.fs.unlink as jest.Mock;

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
    mockLs.mockResolvedValue([]);
    mockUnlink.mockResolvedValue(undefined);
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

    // Review ruling (2026-11-21): a failed download deletes its file. The library saves whatever the
    // server answers under the statement's name, an error body included.
    describe('review fix: a download that is refused leaves no file behind', () => {
      it.each([400, 401, 403, 404, 500, 503, 204, 302])(
        'an answer of %s deletes the file it saved, then throws',
        async status => {
          mockFetch.mockResolvedValue(
            answer(status, '/cache/statement-2026-10.pdf'),
          );

          await expect(openStatement('2026-10', 'pdf', 'el')).rejects.toThrow(
            `Statement download answered ${status}`,
          );

          expect(mockUnlink).toHaveBeenCalledTimes(1);
          expect(mockUnlink).toHaveBeenCalledWith(
            '/cache/statement-2026-10.pdf',
          );
          expect(mockView).not.toHaveBeenCalled();
        },
      );

      it('deletes the file where the download says it was saved, a CSV too', async () => {
        mockFetch.mockResolvedValue(
          answer(404, '/cache/statement-2026-09.csv'),
        );

        await expect(openStatement('2026-09', 'csv', 'en')).rejects.toThrow(
          '404',
        );

        expect(mockUnlink).toHaveBeenCalledWith('/cache/statement-2026-09.csv');
      });

      it('if the file cannot be deleted the rider still gets the download error, not the delete error', async () => {
        mockFetch.mockResolvedValue(answer(500));
        mockUnlink.mockRejectedValue(new Error('no such file'));

        await expect(openStatement('2026-10', 'pdf', 'el')).rejects.toThrow(
          'Statement download answered 500',
        );
        expect(mockView).not.toHaveBeenCalled();
      });

      it('the file is deleted before the error is thrown, not left to finish later', async () => {
        mockFetch.mockResolvedValue(answer(500));
        let deleted = false;
        mockUnlink.mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          deleted = true;
        });

        await expect(openStatement('2026-10', 'pdf', 'el')).rejects.toThrow(
          '500',
        );

        expect(deleted).toBe(true);
      });

      it('a good download (200) is kept: nothing is deleted before the phone opens it', async () => {
        mockFetch.mockResolvedValue(answer(200));

        await openStatement('2026-10', 'pdf', 'el');

        expect(mockUnlink).not.toHaveBeenCalled();
        expect(mockView).toHaveBeenCalledTimes(1);
      });
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

  // Review ruling (2026-11-21): logout and a session end delete every statement file in the cache.
  describe('clearStatementFiles (review fix)', () => {
    it("looks in the app's cache folder", async () => {
      await clearStatementFiles();

      expect(mockLs).toHaveBeenCalledTimes(1);
      expect(mockLs).toHaveBeenCalledWith('/cache');
    });

    it('deletes every statement file, PDF and CSV, of every month', async () => {
      mockLs.mockResolvedValue([
        'statement-2026-10.pdf',
        'statement-2026-10.csv',
        'statement-2025-01.pdf',
      ]);

      await clearStatementFiles();

      expect(mockUnlink.mock.calls.map(call => call[0]).sort()).toEqual([
        '/cache/statement-2025-01.pdf',
        '/cache/statement-2026-10.csv',
        '/cache/statement-2026-10.pdf',
      ]);
    });

    it('deletes nothing else in the cache: only statement-YYYY-MM.pdf and .csv', async () => {
      const others = [
        // Other things the app or the system keeps in its cache.
        'http-cache',
        'image_manager_disk_cache',
        'ReactNativeBlobUtilTmp_abc123',
        'photo.pdf',
        'notes.csv',
        // Near misses of the statement name.
        'statement.pdf',
        'statement-2026-10.txt',
        'statement-2026-10.pdf.bak',
        'statement-2026-10.PDF',
        'statement-2026-1.pdf',
        'statement-26-10.pdf',
        'statement-2026-10-01.pdf',
        'statement-2026-10',
        'statement-2026-10.pdfx',
        'my-statement-2026-10.pdf',
        'xstatement-2026-10.csv',
        'statement-2026-10.pdf/..',
        'Statement-2026-10.pdf',
        'statement-abcd-ef.pdf',
        'statement-2026-10 .pdf',
      ];
      mockLs.mockResolvedValue([...others, 'statement-2026-10.pdf']);

      await clearStatementFiles();

      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith('/cache/statement-2026-10.pdf');
    });

    it('an empty cache is fine: nothing is deleted', async () => {
      mockLs.mockResolvedValue([]);

      await expect(clearStatementFiles()).resolves.toBeUndefined();
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('never throws when the cache folder cannot be read (the system may have cleared it)', async () => {
      mockLs.mockRejectedValue(new Error('ENOENT: no such directory'));

      await expect(clearStatementFiles()).resolves.toBeUndefined();
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('never throws when listing the folder throws outright', async () => {
      mockLs.mockImplementation(() => {
        throw new Error('native module missing');
      });

      await expect(clearStatementFiles()).resolves.toBeUndefined();
    });

    it('a file that cannot be deleted does not stop the others, and nothing is thrown', async () => {
      mockLs.mockResolvedValue([
        'statement-2026-08.pdf',
        'statement-2026-09.pdf',
        'statement-2026-10.csv',
      ]);
      mockUnlink.mockImplementation(async (path: string) => {
        if (path.includes('2026-09')) {
          throw new Error('busy');
        }
      });

      await expect(clearStatementFiles()).resolves.toBeUndefined();

      expect(mockUnlink).toHaveBeenCalledTimes(3);
      expect(mockUnlink).toHaveBeenCalledWith('/cache/statement-2026-08.pdf');
      expect(mockUnlink).toHaveBeenCalledWith('/cache/statement-2026-10.csv');
    });

    it('waits for every other file even when one cannot be deleted', async () => {
      mockLs.mockResolvedValue([
        'statement-2026-09.pdf',
        'statement-2026-10.pdf',
      ]);
      let slowOneDeleted = false;
      mockUnlink.mockImplementation(async (path: string) => {
        if (path.includes('2026-09')) {
          throw new Error('busy');
        }
        await new Promise(resolve => setTimeout(resolve, 5));
        slowOneDeleted = true;
      });

      await clearStatementFiles();

      expect(slowOneDeleted).toBe(true);
    });

    it('has finished deleting when it resolves', async () => {
      mockLs.mockResolvedValue(['statement-2026-10.pdf']);
      let deleted = false;
      mockUnlink.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        deleted = true;
      });

      await clearStatementFiles();

      expect(deleted).toBe(true);
    });
  });
});
