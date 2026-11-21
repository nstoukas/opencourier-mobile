// Spec 0051 (AC-9): why a session ended, when the server said so, for the full screen notice. Held in
// memory only (a module store, like chatOutgoing): it is shown once, then the login screen.

export type SessionEndNotice = {
  kind: 'deactivated' | 'credentials';
  message: string | null;
};

let current: SessionEndNotice | null = null;
const listeners = new Set<() => void>();

export const getSessionEndNotice = (): SessionEndNotice | null => current;

export const setSessionEndNotice = (notice: SessionEndNotice | null): void => {
  current = notice;
  listeners.forEach(listener => listener());
};

export const subscribeSessionEndNotice = (
  listener: () => void,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// The backend's error answer is { error: true, result: [{ code, message, statusCode }] }.
export const errorCodeOf = (
  error: unknown,
): { code: string | undefined; message: string | undefined } => {
  const result = (error as { response?: { data?: { result?: unknown } } })
    ?.response?.data?.result;
  const first = Array.isArray(result) ? result[0] : undefined;
  return {
    code: typeof first?.code === 'string' ? first.code : undefined,
    message: typeof first?.message === 'string' ? first.message : undefined,
  };
};

// AC-9: the notice for a refused request, or null when the code is not one of these two.
export const noticeForRefusal = (error: unknown): SessionEndNotice | null => {
  const { code, message } = errorCodeOf(error);
  if (code === 'ACCOUNT_DEACTIVATED') {
    return { kind: 'deactivated', message: message ?? null };
  }
  if (code === 'CREDENTIALS_CHANGED') {
    return { kind: 'credentials', message: null };
  }
  return null;
};
