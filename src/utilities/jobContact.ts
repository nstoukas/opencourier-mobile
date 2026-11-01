import { Platform } from 'react-native';
import { OrderStatus } from '@app/types/enums';

// Row 72: how a rider reaches the restaurant, the customer and dispatch from the job screen.
// Calls and messages go through the phone's own apps; the app records none of them (value 5).

// `typeof Platform.OS` is the type of that value: 'android', 'ios' and the other platforms.
type OS = typeof Platform.OS;

// The job is over for contact purposes once the shown status is dropped off or canceled. The
// shown status counts a drop off still waiting for signal (row 33 review), so no button outlives it.
// `status` is plain text on Order (the API's value), compared with the enum's text values.
export const isJobOver = (status: string): boolean =>
  status === OrderStatus.dropped_off || status === OrderStatus.canceled;

// The three preset messages a rider can send the customer. Greek first, because the customer
// reads it in Volos; English after it, because the app (and so the rider's choice) is in English.
// `as const` keeps each key as its exact text, so a typo in a key fails typecheck.
export const CUSTOMER_SMS_PRESETS = [
  {
    key: 'sms_outside',
    body: "Είμαι έξω. / I'm outside.",
  },
  {
    key: 'sms_arriving_5',
    body: 'Φτάνω σε 5 λεπτά. / Arriving in 5 min.',
  },
  {
    key: 'sms_cant_find_entrance',
    body: "Δεν βρίσκω την είσοδο. / I can't find the entrance.",
  },
] as const;

// Opens the dialer with the number filled in; the rider still presses call.
export const telUrl = (phoneNumber: string): string => `tel:${phoneNumber}`;

// Opens the phone's own messages app with the text filled in; the rider still presses send.
// Android reads the text after `?body=`, iOS after `&body=`.
export const smsUrl = (
  phoneNumber: string,
  body: string,
  os: OS = Platform.OS,
): string =>
  `sms:${phoneNumber}${os === 'ios' ? '&' : '?'}body=${encodeURIComponent(
    body,
  )}`;
