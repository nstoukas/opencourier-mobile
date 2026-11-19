import { toApiUrl, toSocketUrl, isAddressUsable, apiUrl, socketUrl } from './config';
import { client } from '@app/services/Client';

describe('Config and Client URL configuration (spec 0039, AC-1, AC-4)', () => {
  describe('toApiUrl', () => {
    it('removes trailing slashes from the API address', () => {
      expect(toApiUrl('https://coop.example.com/api/courier/v1/')).toBe(
        'https://coop.example.com/api/courier/v1',
      );
      expect(toApiUrl('https://coop.example.com/api/courier/v1///')).toBe(
        'https://coop.example.com/api/courier/v1',
      );
      expect(toApiUrl('  https://coop.example.com/api/courier/v1/  ')).toBe(
        'https://coop.example.com/api/courier/v1',
      );
    });

    it('returns empty string when input is not a string', () => {
      expect(toApiUrl(undefined)).toBe('');
      expect(toApiUrl(null)).toBe('');
      expect(toApiUrl(123)).toBe('');
    });
  });

  describe('toSocketUrl', () => {
    it('turns http origin into ws and https origin into wss', () => {
      expect(toSocketUrl('http://localhost:3000/api/courier/v1')).toBe(
        'ws://localhost:3000',
      );
      expect(toSocketUrl('https://coop.example.com/api/courier/v1/')).toBe(
        'wss://coop.example.com',
      );
      expect(toSocketUrl('https://coop.example.com:8443/api/courier/v1')).toBe(
        'wss://coop.example.com:8443',
      );
    });

    it('returns empty string for invalid address', () => {
      expect(toSocketUrl('')).toBe('');
      expect(toSocketUrl('not-a-valid-url')).toBe('');
    });
  });

  describe('exported apiUrl and socketUrl', () => {
    it('apiUrl has no trailing slash and matches Client baseURL', () => {
      expect(apiUrl).toBeDefined();
      expect(apiUrl.endsWith('/')).toBe(false);
      expect(client.defaults.baseURL).toBe(apiUrl);
    });

    it('socketUrl is the origin of apiUrl with ws or wss', () => {
      expect(socketUrl).toBeDefined();
      expect(/^wss?:\/\//.test(socketUrl)).toBe(true);
      expect(socketUrl).not.toContain('/api/');
    });
  });

  describe('isAddressUsable (AC-4)', () => {
    it('allows http in development mode (__DEV__ true)', () => {
      expect(isAddressUsable('http://localhost:3000/api/courier/v1', true)).toBe(true);
      expect(isAddressUsable('https://coop.example.com/api/courier/v1', true)).toBe(true);
      expect(isAddressUsable('', true)).toBe(false);
    });

    it('requires https in release mode (__DEV__ false)', () => {
      expect(isAddressUsable('http://coop.example.com/api/courier/v1', false)).toBe(false);
      expect(isAddressUsable('https://coop.example.com/api/courier/v1', false)).toBe(true);
      expect(isAddressUsable('', false)).toBe(false);
    });
  });
});
