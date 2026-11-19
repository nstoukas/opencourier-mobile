import { AxiosError } from 'axios';

// Row 17 (spec 0039, AC-5, AC-6, AC-11): what a logged out screen tells the
// rider after a failed request, as a translation key. Plain words, never an
// HTTP code. `screen` picks the sentence a status means on that screen.
export type AuthScreenKind = 'login' | 'forgot' | 'reset';

export const authErrorKey = (
  error: unknown,
  screen: AuthScreenKind,
): string => {
  const response = (error as AxiosError | undefined)?.response;
  if (!response) {
    // The request never got an answer: no signal, or the server is down.
    return 'auth_error_no_connection';
  }
  const status = response.status;
  if (status === 429) {
    return 'auth_error_too_many';
  }
  if (screen === 'login' && status === 403) {
    return 'auth_error_wrong_login';
  }
  if (screen === 'forgot' && status === 503) {
    return 'auth_error_reset_off';
  }
  // Every 400 on reset is the code sentence: the app checks the password
  // length itself before sending (AC-11).
  if (screen === 'reset' && status === 400) {
    return 'auth_error_wrong_code';
  }
  return 'auth_error_other';
};
