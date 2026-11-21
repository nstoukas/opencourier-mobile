import { client } from '@app/services/Client';
import { saveSession } from '@app/services/session';

// Spec 0051 (row 108): the rider's own account. Every answer is wrapped by the backend as { error, result }.

// DEACTIVATED, REACTIVATED, FIELD_EDITED or PASSWORD_CHANGED; `by` is "the co-op" or "you", never a name.
export type AccountChange = {
  id: string;
  kind: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  by: 'the co-op' | 'you';
  createdAt: string;
};

export type EmergencyContact = { name: string | null; phone: string | null };

export const fetchAccountChanges = async (): Promise<AccountChange[]> => {
  const { data } = await client.get('courier/account-changes');
  return data.result as AccountChange[];
};

export const fetchEmergencyContact = async (): Promise<EmergencyContact> => {
  const { data } = await client.get('courier/emergency-contact');
  return data.result as EmergencyContact;
};

export const saveEmergencyContact = async (
  contact: EmergencyContact,
): Promise<EmergencyContact> => {
  const { data } = await client.put('courier/emergency-contact', contact);
  return data.result as EmergencyContact;
};

// AC-8: the server checks the current password, signs out the other phones and answers with fresh tokens
// for this one, saved here like a login. `pushToken` keeps this phone's offer pushes.
export const changePassword = async (params: {
  currentPassword: string;
  newPassword: string;
  pushToken?: string;
}): Promise<void> => {
  const { data } = await client.post('auth/change-password', params);
  const { accessToken, refreshToken } = data.result.session;
  await saveSession(accessToken, refreshToken, client);
};
