import { client } from '@app/services/Client';
import { saveSession } from '@app/services/session';
import {
  changePassword,
  fetchAccountChanges,
  fetchEmergencyContact,
  saveEmergencyContact,
} from './accountApi';

jest.mock('@app/services/Client', () => ({
  client: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock('@app/services/session', () => ({
  saveSession: jest.fn().mockResolvedValue(undefined),
}));

const http = client as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
};

// Spec 0051 (row 108): the rider's own account calls. The spec's routes, under courier/v1:
// GET courier/account-changes, GET and PUT courier/emergency-contact, POST auth/change-password.
describe('accountApi (spec 0051)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetchAccountChanges: GET courier/account-changes with no rider id, answering the server's list in its order", async () => {
    const changes = [
      { id: 'change-2', kind: 'REACTIVATED', by: 'the co-op' },
      { id: 'change-1', kind: 'DEACTIVATED', by: 'the co-op' },
    ];
    http.get.mockResolvedValueOnce({ data: { error: null, result: changes } });

    const result = await fetchAccountChanges();

    expect(http.get).toHaveBeenCalledTimes(1);
    expect(http.get.mock.calls[0]).toEqual(['courier/account-changes']);
    expect(result).toEqual(changes);
  });

  it('fetchEmergencyContact: GET courier/emergency-contact, answering name and phone', async () => {
    http.get.mockResolvedValueOnce({
      data: {
        error: null,
        result: { name: 'Maria Rider', phone: '+306922222222' },
      },
    });

    const result = await fetchEmergencyContact();

    expect(http.get.mock.calls[0]).toEqual(['courier/emergency-contact']);
    expect(result).toEqual({ name: 'Maria Rider', phone: '+306922222222' });
  });

  it('saveEmergencyContact: PUT courier/emergency-contact with name and phone, answering what the server stored', async () => {
    http.put.mockResolvedValueOnce({
      data: {
        error: null,
        result: { name: 'Maria Rider', phone: '+306922222222' },
      },
    });

    const result = await saveEmergencyContact({
      name: ' Maria Rider',
      phone: '+306922222222',
    });

    expect(http.put).toHaveBeenCalledTimes(1);
    expect(http.put).toHaveBeenCalledWith('courier/emergency-contact', {
      name: ' Maria Rider',
      phone: '+306922222222',
    });
    expect(result).toEqual({ name: 'Maria Rider', phone: '+306922222222' });
  });

  it('saveEmergencyContact sends an emptied part as null', async () => {
    http.put.mockResolvedValueOnce({
      data: { error: null, result: { name: null, phone: null } },
    });

    await saveEmergencyContact({ name: null, phone: null });

    expect(http.put).toHaveBeenCalledWith('courier/emergency-contact', {
      name: null,
      phone: null,
    });
  });

  describe('changePassword (AC-8)', () => {
    const answer = {
      data: {
        error: null,
        result: {
          id: 'user-1',
          session: {
            accessToken: 'fresh-access',
            refreshToken: 'fresh-refresh',
          },
        },
      },
    };

    it("POST auth/change-password with the current and new password and this phone's push token", async () => {
      http.post.mockResolvedValueOnce(answer);

      await changePassword({
        currentPassword: 'current-password',
        newPassword: 'a-new-password',
        pushToken: 'token-this-phone',
      });

      expect(http.post).toHaveBeenCalledTimes(1);
      expect(http.post).toHaveBeenCalledWith('auth/change-password', {
        currentPassword: 'current-password',
        newPassword: 'a-new-password',
        pushToken: 'token-this-phone',
      });
    });

    it("saves the fresh tokens the server answered as this phone's session, like a login", async () => {
      http.post.mockResolvedValueOnce(answer);

      await changePassword({
        currentPassword: 'current-password',
        newPassword: 'a-new-password',
      });

      expect(saveSession).toHaveBeenCalledTimes(1);
      expect(saveSession).toHaveBeenCalledWith(
        'fresh-access',
        'fresh-refresh',
        client,
      );
    });

    it('a refusal saves no session and reaches the screen as it is', async () => {
      const refusal = {
        response: {
          status: 400,
          data: {
            error: true,
            result: [
              {
                code: 'BAD_REQUEST',
                message: 'Your current password is not right.',
              },
            ],
          },
        },
      };
      http.post.mockRejectedValueOnce(refusal);

      await expect(
        changePassword({
          currentPassword: 'not-it',
          newPassword: 'a-new-password',
        }),
      ).rejects.toBe(refusal);
      expect(saveSession).not.toHaveBeenCalled();
    });
  });
});
