import NotificationDeviceService from './notificationDeviceService';

describe('NotificationDeviceService (spec 0003, AC-1)', () => {
  const mockPost = jest.fn();
  const mockDelete = jest.fn();

  const fakeClient: any = {
    post: mockPost,
    delete: mockDelete,
  };

  const service = NotificationDeviceService(fakeClient);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registerDevice sends POST devices with token and platform ANDROID', async () => {
    mockPost.mockResolvedValueOnce({ status: 204 });

    await service.registerDevice('test-device-token-123');

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('devices', {
      token: 'test-device-token-123',
      platform: 'ANDROID',
    });
  });

  it('unregisterDevice sends DELETE devices/:token with timeout and URL encoded token', async () => {
    mockDelete.mockResolvedValueOnce({ status: 204 });

    const complexToken = 'fcm:token/with+special:chars';
    await service.unregisterDevice(complexToken, { timeoutMs: 3000 });

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith(
      `devices/${encodeURIComponent(complexToken)}`,
      {
        timeout: 3000,
      },
    );
  });
});
