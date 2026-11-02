import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { HistoryScreen } from './History';
import { HistoryCell } from '@app/components/HistoryCell/HistoryCell';
import { HomeEmptyStateComponent } from '@app/components/HomeEmptyState/HomeEmptyState';
import { SkeletonOrderHistoryCell } from '@app/components/SkeletonOrderHistoryCell/SkeletonOrderHistoryCell';
import { ReportAnIncident } from '@app/components/ReportAnIncident/ReportAnIncident';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { services } from '@app/services/service';
import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';

describe('HistoryScreen (spec 0018, AC-13)', () => {
  let queryClient: QueryClient;
  const mockNavigation: any = {
    toggleDrawer: jest.fn(),
  };

  const sampleOrder: Order = {
    id: 'hist-1',
    number: 'ORD-101',
    status: OrderStatus.dropped_off,
    pickupBusinessName: 'Souvlaki Bar',
    dropoffName: 'Nikos',
    totalCompensation: 450,
  } as unknown as Order;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderHistory = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <HistoryScreen navigation={mockNavigation} route={{} as any} />
      </QueryClientProvider>,
    );

  it('renders history query rows with HistoryCell', async () => {
    jest
      .spyOn(services.orderService, 'getOrdersHistory')
      .mockResolvedValueOnce([sampleOrder]);

    const { UNSAFE_getAllByType } = renderHistory();

    await waitFor(() => {
      const cells = UNSAFE_getAllByType(HistoryCell);
      expect(cells.length).toBe(1);
      expect(cells[0].props.order).toEqual(sampleOrder);
    });
  });

  it('renders empty state when history list is empty', async () => {
    jest
      .spyOn(services.orderService, 'getOrdersHistory')
      .mockResolvedValueOnce([]);

    const { UNSAFE_getByType } = renderHistory();

    await waitFor(() => {
      expect(UNSAFE_getByType(HomeEmptyStateComponent)).toBeTruthy();
    });
  });

  it('renders skeleton cells while history is loading', () => {
    // Hang promise to simulate loading
    jest
      .spyOn(services.orderService, 'getOrdersHistory')
      .mockReturnValue(new Promise(() => {}));

    const { UNSAFE_getAllByType } = renderHistory();

    const skeletons = UNSAFE_getAllByType(SkeletonOrderHistoryCell);
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('back navigation button calls navigation.toggleDrawer()', async () => {
    jest
      .spyOn(services.orderService, 'getOrdersHistory')
      .mockResolvedValueOnce([]);

    const { UNSAFE_getByType } = renderHistory();

    const backBtn = UNSAFE_getByType(BackNavButton);
    fireEvent.press(backBtn);
    expect(mockNavigation.toggleDrawer).toHaveBeenCalledTimes(1);
  });

  it('renders ReportAnIncident and dismisses it when dismissed', async () => {
    jest
      .spyOn(services.orderService, 'getOrdersHistory')
      .mockResolvedValueOnce([]);

    const { UNSAFE_getByType, UNSAFE_queryByType } = renderHistory();

    const reportIncident = UNSAFE_getByType(ReportAnIncident);
    expect(reportIncident).toBeTruthy();

    fireEvent(reportIncident, 'dismiss');
    expect(UNSAFE_queryByType(ReportAnIncident)).toBeNull();
  });
});
