//@ts-ignore
import { AUTH0_DOMAIN, AUTH0_CLIENT_ID, API_URL } from '@env';

export const auth0Domain = AUTH0_DOMAIN;
export const auth0ClientId = AUTH0_CLIENT_ID;

// Row 17 (spec 0039, AC-1): the app talks to exactly one server, the co-op's, fixed when the app is
// built from `API_URL` in `.env`. Nothing the rider does can change it.

// The API address with any trailing slash removed, e.g. `https://coop.gr/api/courier/v1`.
export const toApiUrl = (raw: unknown): string =>
  typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : '';

// The live connection's address: the origin (scheme, host and port) of the API address, with
// `http` turned into `ws` and `https` into `wss`. Socket.IO runs on the backend's own HTTP server.
export const toSocketUrl = (api: string): string => {
  const match = /^(https?):\/\/([^/?#]+)/i.exec(api);
  if (!match) {
    return '';
  }
  const scheme = match[1].toLowerCase() === 'https' ? 'wss' : 'ws';
  return `${scheme}://${match[2]}`;
};

export const apiUrl = toApiUrl(API_URL);
export const socketUrl = toSocketUrl(apiUrl);

// AC-4: a release build (`__DEV__` false) needs an `https://` address. Without one the login screen
// says so and sends nothing. Dev builds may use `http://localhost`.
export const isAddressUsable = (api: string, isDev: boolean): boolean =>
  api !== '' && (isDev || /^https:\/\//i.test(api));

export const hasUsableAddress = isAddressUsable(apiUrl, __DEV__);
