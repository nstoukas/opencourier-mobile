import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePickupPoints } from './usePickupPoints';
import { services } from '@app/services/service';

describe('usePickupPoints (spec 0018, AC-11)', () => {
  let queryClient: QueryClient;
  const mockGetPickupPoints = jest.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    jest.clearAllMocks();
    services.routeService.getPickupPoints = mockGetPickupPoints;
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('fetches pickup points when enabled is true', async () => {
    const mockPoints = [
      { id: 'p1', name: 'Restaurant 1', latitude: 39.36, longitude: 22.94 },
    ];
    mockGetPickupPoints.mockResolvedValueOnce(mockPoints);

    const { result } = renderHook(() => usePickupPoints(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPoints);
    expect(mockGetPickupPoints).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when enabled is false', () => {
    const { result } = renderHook(() => usePickupPoints(false), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetPickupPoints).not.toHaveBeenCalled();
  });
});
