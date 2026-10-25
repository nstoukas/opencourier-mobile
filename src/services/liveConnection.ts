import { io, Socket } from 'socket.io-client';
import { UserStatus } from '@app/types/types';

// What the dot on the home screen shows (row 57).
// - 'off': the app is not trying to connect (logged out, or Offline with no job).
// - 'connecting': a connection is being opened.
// - 'connected': the server can reach this phone right now.
// - 'disconnected': the connection dropped; socket.io keeps retrying on its own.
export type ConnectionStatus =
  | 'off'
  | 'connecting'
  | 'connected'
  | 'disconnected';

// Event names the backend sends (backend `NotificationEventType`).
export const OFFER_EVENT = 'NEW_DELIVERY_OFFER';
export const DELIVERY_STATUS_UPDATED_EVENT = 'DELIVERY_STATUS_UPDATED';

// The backend only accepts couriers on this socket.io namespace
// (`SOCKET_GATEWAY_NAMESPACE` in the backend). Connecting to the bare URL lands
// on the default namespace, which has no login and never receives an offer.
export const COURIER_NAMESPACE = '/couriers';

// Builds the address to connect to: the instance's websocket link plus the
// courier namespace, without doubling slashes or the namespace.
export const courierSocketUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return trimmed.endsWith(COURIER_NAMESPACE)
    ? trimmed
    : `${trimmed}${COURIER_NAMESPACE}`;
};

// Opens the real socket. socket.io reconnects on its own after a network drop
// (its default), so nothing here schedules retries by hand.
export const createCourierSocket = (url: string, token: string): Socket =>
  io(courierSocketUrl(url), {
    transports: ['websocket'],
    auth: { authorization: `Bearer ${token}` },
  });

// Should the app hold a live connection? Only while logged in, and either not
// Offline or still carrying a job. A rider on Last call is switched to Offline
// by the server once they accept, and must still hear that job get canceled.
export const shouldBeConnected = (
  userStatus: UserStatus | undefined,
  activeJobCount: number,
): boolean => {
  if (userStatus === undefined) {
    return false;
  }
  return userStatus !== UserStatus.Offline || activeJobCount > 0;
};

export type LiveConnectionHandlers = {
  onStatus: (status: ConnectionStatus) => void;
  onOffer: () => void;
  onDeliveryStatusUpdated: () => void;
  // Runs on every (re)connect, so anything sent while the phone was away is
  // fetched again.
  onConnected: () => void;
};

// Owns at most one socket at a time. Plain class with no React in it, so the
// rules (one socket, close on logout, retry on foreground) can be tested alone.
export class LiveConnection {
  private socket: Socket | null = null;
  // The url and token the current socket was opened with.
  private openedWith: string | null = null;
  private status: ConnectionStatus = 'off';

  constructor(
    // Passed in rather than imported, so a test can hand in a fake socket.
    private readonly makeSocket: (url: string, token: string) => Socket,
    private readonly handlers: LiveConnectionHandlers,
  ) {}

  getStatus(): ConnectionStatus {
    return this.status;
  }

  // Connect with this url and token. Calling it again with the same values
  // keeps the existing socket; a new token (another login) replaces it.
  open(url: string, token: string): void {
    const key = `${url} ${token}`;
    if (this.socket && this.openedWith === key) {
      return;
    }
    this.close();

    const socket = this.makeSocket(url, token);
    this.socket = socket;
    this.openedWith = key;
    this.setStatus(socket.connected ? 'connected' : 'connecting');

    socket.on('connect', () => {
      this.setStatus('connected');
      this.handlers.onConnected();
    });
    socket.on('disconnect', () => this.setStatus('disconnected'));
    socket.on('connect_error', () => this.setStatus('disconnected'));
    socket.on(OFFER_EVENT, () => this.handlers.onOffer());
    socket.on(DELIVERY_STATUS_UPDATED_EVENT, () =>
      this.handlers.onDeliveryStatusUpdated(),
    );
  }

  // The app came back to the foreground. If the socket is down (for example
  // the server refused it, which socket.io does not retry), try again now.
  resume(): void {
    if (this.socket && !this.socket.connected) {
      this.setStatus('connecting');
      this.socket.connect();
    }
  }

  // Close the socket for good (logout, going Offline). Safe to call twice.
  close(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.openedWith = null;
    }
    this.setStatus('off');
  }

  private setStatus(status: ConnectionStatus): void {
    if (status !== this.status) {
      this.status = status;
      this.handlers.onStatus(status);
    }
  }
}
