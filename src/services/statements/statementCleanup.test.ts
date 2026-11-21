import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { services } from '../service';
import { clearRiderDataOnPhone, endExpiredSession } from '../session';
import { queryClient } from '../queryClient';

// Spec 0050, review ruling of 2026-11-21 (row 76): a rider's statements leave the phone at logout and at a
// session end, like the rest of their data. The real clearStatementFiles runs here, over the mocked native
// file module (jest.setup.js), so these tests see which files are really asked to be deleted.

jest.mock('../offerPush/offerAlert', () => ({
  cancelAllOfferAlerts: jest.fn().mockResolvedValue(undefined),
}));

const blob = jest.mocked(ReactNativeBlobUtil);
const mockLs = blob.fs.ls as jest.Mock;
const mockUnlink = blob.fs.unlink as jest.Mock;

// Lets every promise already started run to its end.
const settle = async () => {
  for (let turn = 0; turn < 20; turn += 1) {
    await Promise.resolve();
  }
};

const IN_CACHE = [
  'statement-2026-10.pdf',
  'statement-2026-09.csv',
  'http-cache',
  'photo.pdf',
];
const deletedFiles = () => mockUnlink.mock.calls.map(call => call[0]).sort();

describe('statement files leave the phone with the rider (spec 0050, review fix)', () => {
  let http: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockLs.mockResolvedValue(IN_CACHE);
    mockUnlink.mockResolvedValue(undefined);
    http = { defaults: { headers: { common: {} } } };
    jest
      .spyOn(queryClient, 'resetQueries')
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logout (services/Services.ts)', () => {
    it("deletes the rider's statement files from the cache, and only those", async () => {
      services.logout();
      await settle();

      expect(mockLs).toHaveBeenCalledWith('/cache');
      expect(deletedFiles()).toEqual([
        '/cache/statement-2026-09.csv',
        '/cache/statement-2026-10.pdf',
      ]);
    });

    it('does not throw, and leaves no rejected promise, when the cache cannot be read', async () => {
      mockLs.mockRejectedValue(new Error('ENOENT'));

      expect(() => services.logout()).not.toThrow();
      await settle();

      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('does not throw when a file cannot be deleted', async () => {
      mockUnlink.mockRejectedValue(new Error('busy'));

      expect(() => services.logout()).not.toThrow();
      await settle();

      expect(mockUnlink).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearRiderDataOnPhone (services/session.ts)', () => {
    it("deletes the rider's statement files from the cache, and only those, before it resolves", async () => {
      await clearRiderDataOnPhone(http);

      expect(mockLs).toHaveBeenCalledWith('/cache');
      expect(deletedFiles()).toEqual([
        '/cache/statement-2026-09.csv',
        '/cache/statement-2026-10.pdf',
      ]);
    });

    it('still forgets the login when the cache cannot be read', async () => {
      await AsyncStorage.setItem('token', 'rider-token');
      await AsyncStorage.setItem('refreshToken', 'rider-refresh');
      mockLs.mockRejectedValue(new Error('ENOENT'));

      await expect(clearRiderDataOnPhone(http)).resolves.toBeUndefined();

      expect(await AsyncStorage.getItem('token')).toBeNull();
      expect(await AsyncStorage.getItem('refreshToken')).toBeNull();
    });

    it('resolves when a file cannot be deleted', async () => {
      mockUnlink.mockRejectedValue(new Error('busy'));

      await expect(clearRiderDataOnPhone(http)).resolves.toBeUndefined();
    });
  });

  it('a session the server ended (endExpiredSession) deletes them too', async () => {
    await endExpiredSession(http);

    expect(deletedFiles()).toEqual([
      '/cache/statement-2026-09.csv',
      '/cache/statement-2026-10.pdf',
    ]);
  });
});
