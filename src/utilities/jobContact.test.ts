import { OrderStatus } from '@app/types/enums';
import {
  isJobOver,
  telUrl,
  smsUrl,
  CUSTOMER_SMS_PRESETS,
} from './jobContact';

describe('jobContact (row 72, decisions 72.4, 72.5)', () => {
  describe('isJobOver', () => {
    it('returns true only for dropped_off and canceled statuses', () => {
      // End statuses where contact controls must disappear
      expect(isJobOver(OrderStatus.dropped_off)).toBe(true);
      expect(isJobOver(OrderStatus.canceled)).toBe(true);

      // Active / ongoing statuses where contact controls must remain available
      expect(isJobOver(OrderStatus.created)).toBe(false);
      expect(isJobOver(OrderStatus.accepted)).toBe(false);
      expect(isJobOver(OrderStatus.dispatched)).toBe(false);
      expect(isJobOver(OrderStatus.courier_arrived_at_pickup_location)).toBe(false);
      expect(isJobOver(OrderStatus.picked_up)).toBe(false);
      expect(isJobOver(OrderStatus.on_the_way)).toBe(false);
      expect(isJobOver(OrderStatus.courier_arrived_at_dropoff_location)).toBe(false);
      expect(isJobOver('unknown_status')).toBe(false);
      expect(isJobOver('')).toBe(false);
    });
  });

  describe('telUrl', () => {
    it('creates a tel: URI with the exact phone number', () => {
      expect(telUrl('+302421012345')).toBe('tel:+302421012345');
      expect(telUrl('6912345678')).toBe('tel:6912345678');
      expect(telUrl('')).toBe('tel:');
    });
  });

  describe('smsUrl', () => {
    const phoneNumber = '+306912345678';
    const greekAndEnglishBody = "Είμαι έξω. / I'm outside.";

    it('uses ?body= on android with URI-encoded body (Greek letters, spaces, slash)', () => {
      const url = smsUrl(phoneNumber, greekAndEnglishBody, 'android');
      expect(url).toBe(
        `sms:+306912345678?body=${encodeURIComponent(greekAndEnglishBody)}`,
      );
      // Explicitly check URI encoded parts
      expect(url).toContain('?body=');
      expect(url).not.toContain('&body=');
      expect(url).toContain('%2F'); // slash encoded
      expect(url).toContain('%20'); // space encoded
      // Greek characters must be encoded, not raw
      expect(url).not.toContain('Είμαι');
    });

    it('uses &body= on ios with URI-encoded body', () => {
      const url = smsUrl(phoneNumber, greekAndEnglishBody, 'ios');
      expect(url).toBe(
        `sms:+306912345678&body=${encodeURIComponent(greekAndEnglishBody)}`,
      );
      expect(url).toContain('&body=');
      expect(url).not.toContain('?body=');
      expect(url).toContain('%2F');
      expect(url).toContain('%20');
      expect(url).not.toContain('Είμαι');
    });

    it('defaults to Platform.OS when os parameter is omitted', () => {
      const url = smsUrl(phoneNumber, 'Hello');
      expect(url).toMatch(/^sms:\+306912345678[?&]body=Hello$/);
    });
  });

  describe('CUSTOMER_SMS_PRESETS', () => {
    it('defines exactly three preset messages with Greek first followed by English', () => {
      expect(CUSTOMER_SMS_PRESETS).toHaveLength(3);

      const [outside, arriving, cantFind] = CUSTOMER_SMS_PRESETS;

      expect(outside).toEqual({
        key: 'sms_outside',
        body: "Είμαι έξω. / I'm outside.",
      });

      expect(arriving).toEqual({
        key: 'sms_arriving_5',
        body: 'Φτάνω σε 5 λεπτά. / Arriving in 5 min.',
      });

      expect(cantFind).toEqual({
        key: 'sms_cant_find_entrance',
        body: "Δεν βρίσκω την είσοδο. / I can't find the entrance.",
      });

      for (const preset of CUSTOMER_SMS_PRESETS) {
        // Must contain both a Greek part and an English part separated by ' / '
        const parts = preset.body.split(' / ');
        expect(parts).toHaveLength(2);
        // Greek part contains Greek Unicode characters
        expect(/[\u0370-\u03FF]/.test(parts[0])).toBe(true);
        // English part contains Latin characters
        expect(/[a-zA-Z]/.test(parts[1])).toBe(true);
      }
    });
  });
});
