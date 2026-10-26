import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useUser from './useUser';

const mockSetUserStatus = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@app/services/service', () => ({
  services: {
    userService: {
      getUser: () => mockGetUser(),
      setUserStatus: (...args: any[]) => mockSetUserStatus(...args),
      setDeliverySettings: jest.fn(),
      setUserLocation: jest.fn(),
    },
  },
}));

function UserHookHost({
  onRender,
}: {
  onRender: (hook: ReturnType<typeof useUser>) => void;
}) {
  const hook = useUser();
  onRender(hook);
  return null;
}

describe('useUser (M5)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: 'courier-1', status: 'ONLINE' });
    mockSetUserStatus.mockResolvedValue({});
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('updateStatus calls setUserStatus with only the status, preventing react-query context from leaking into options (M5)', async () => {
    let hookResult: ReturnType<typeof useUser> | undefined;

    renderer.create(
      <QueryClientProvider client={queryClient}>
        <UserHookHost
          onRender={h => {
            hookResult = h;
          }}
        />
      </QueryClientProvider>,
    );

    await act(async () => {
      hookResult?.updateStatus('OFFLINE');
      await Promise.resolve();
    });

    expect(mockSetUserStatus).toHaveBeenCalledTimes(1);
    // Explicitly verify only 1 argument was passed: status string, no options or react-query context
    expect(mockSetUserStatus.mock.calls[0]).toHaveLength(1);
    expect(mockSetUserStatus.mock.calls[0][0]).toBe('OFFLINE');
  });
});
