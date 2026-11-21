import { client } from '@app/services/Client';
import { saveSession, whileChangingCredentials } from '@app/services/session';
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
  // Row 108 review: the change runs inside this hold. Here it only hands the work back.
  whileChangingCredentials: jest.fn((work: Promise<unknown>) => work),
}));

const mockHold = whileChangingCredentials as jest.Mock;

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

    // Row 108 review (ruling: "A request in flight during the change logs the rider out"): the server
    // refuses the old token from the moment it saves the new password, so the whole change, from the
    // request to the new tokens being saved, runs inside the session's hold.
    describe('runs inside the credentials hold (row 108 review)', () => {
      // Whether a promise has settled yet, without waiting for it.
      const stateOf = async (promise: Promise<unknown>) => {
        let state = 'pending';
        promise.then(
          () => (state = 'done'),
          () => (state = 'failed'),
        );
        await new Promise(resolve => setImmediate(resolve));
        return state;
      };

      it('the hold is taken once, and lasts until the new tokens are saved', async () => {
        let tokensAreSaved!: () => void;
        (saveSession as jest.Mock).mockReturnValueOnce(
          new Promise<void>(resolve => {
            tokensAreSaved = resolve;
          }),
        );
        http.post.mockResolvedValueOnce(answer);

        const change = changePassword({
          currentPassword: 'current-password',
          newPassword: 'a-new-password',
        });

        expect(mockHold).toHaveBeenCalledTimes(1);
        const held = mockHold.mock.calls[0][0] as Promise<unknown>;
        expect(typeof held.then).toBe('function');
        // The server has answered, the tokens are not saved yet: the hold is still on.
        expect(await stateOf(held)).toBe('pending');
        expect(saveSession).toHaveBeenCalledTimes(1);

        tokensAreSaved();
        await change;
        expect(await stateOf(held)).toBe('done');
      });

      it('the hold is already on when the request is sent', async () => {
        let holdsWhenSent = -1;
        http.post.mockImplementationOnce(async () => {
          // The hold is asked for in the same turn the request leaves in.
          await Promise.resolve();
          holdsWhenSent = mockHold.mock.calls.length;
          return answer;
        });

        await changePassword({
          currentPassword: 'current-password',
          newPassword: 'a-new-password',
        });

        expect(holdsWhenSent).toBe(1);
      });

      it('a refused change ends the hold with that refusal', async () => {
        const refusal = { response: { status: 400, data: { error: true } } };
        http.post.mockRejectedValueOnce(refusal);

        await expect(
          changePassword({
            currentPassword: 'not-it',
            newPassword: 'a-new-password',
          }),
        ).rejects.toBe(refusal);

        expect(mockHold).toHaveBeenCalledTimes(1);
        await expect(mockHold.mock.calls[0][0]).rejects.toBe(refusal);
      });

      it('no other account call takes the hold', async () => {
        http.get.mockResolvedValue({ data: { error: null, result: [] } });
        http.put.mockResolvedValue({ data: { error: null, result: {} } });

        await fetchAccountChanges();
        await fetchEmergencyContact();
        await saveEmergencyContact({ name: null, phone: null });

        expect(mockHold).not.toHaveBeenCalled();
      });
    });
  });
});
