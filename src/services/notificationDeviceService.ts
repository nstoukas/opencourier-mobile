import { UClient } from './Client';

// This phone's push address (its FCM token) on the backend (row 58, spec 0003,
// AC-1). The backend keeps one row per token, owned by the rider who last
// registered it, and sends that rider's offers to it. Nothing else is stored:
// no time, no "last seen" (value 5).
export interface NotificationDeviceService {
  registerDevice: (token: string) => Promise<void>;
  // `options.timeoutMs` replaces the client's usual 10 s wait, for logging out.
  unregisterDevice: (
    token: string,
    options?: { timeoutMs?: number },
  ) => Promise<void>;
}

const NotificationDeviceService = (
  client: UClient,
): NotificationDeviceService => {
  const registerDevice = async (token: string): Promise<void> => {
    // Only Android registers for now; iPhone tokens come with row 59.
    await client.post('devices', { token, platform: 'ANDROID' });
  };

  const unregisterDevice = async (
    token: string,
    options?: { timeoutMs?: number },
  ): Promise<void> => {
    // `encodeURIComponent` keeps a token's ':' and other characters from
    // being read as part of the address.
    await client.delete(`devices/${encodeURIComponent(token)}`, {
      timeout: options?.timeoutMs,
    });
  };

  return { registerDevice, unregisterDevice };
};

export default NotificationDeviceService;
