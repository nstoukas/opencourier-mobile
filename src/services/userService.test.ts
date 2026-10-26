import userService from './userService';
import { UClient } from './Client';

describe('userService (spec 0002, M5)', () => {
  it('calls client.patch with uppercase status and no timeout when options are omitted', async () => {
    const mockPatch = jest.fn().mockResolvedValue({ data: {} });
    const client = { patch: mockPatch } as unknown as UClient;
    const service = userService(client);

    await service.setUserStatus('offline');

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith(
      'courier/status',
      { status: 'OFFLINE' },
      { timeout: undefined },
    );
  });

  it('passes timeoutMs option to client.patch when specified (M5: LOGOUT_OFFLINE_TIMEOUT_MS)', async () => {
    const mockPatch = jest.fn().mockResolvedValue({ data: {} });
    const client = { patch: mockPatch } as unknown as UClient;
    const service = userService(client);

    await service.setUserStatus('offline', { timeoutMs: 3000 });

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith(
      'courier/status',
      { status: 'OFFLINE' },
      { timeout: 3000 },
    );
  });
});
