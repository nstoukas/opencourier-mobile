import React from 'react';
import { RefreshControl } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import '@app/localization/i18n';
import { Earnings } from './Earnings';
import { useEarningsMonth, useEarningsMonths } from '@app/hooks/useEarnings';
import { useCoopTotals } from '@app/hooks/useTimeWorked';
import { useReviewRequests } from '@app/hooks/useReviewRequests';
import { useReviewSeen } from '@app/services/reviewSeen';
import { queryClient } from '@app/services/queryClient';
import { fetchStatementMonths } from '@app/services/statements/statementsApi';

// Spec 0050, review ruling of 2026-11-21 (row 76): when the statement months cannot be loaded the rider
// reads "Could not load your statements. Pull to try again.", and pulling did nothing. Here the real
// Statements section sits in the real Earnings screen, on the app's own query cache, and only the request
// for the months is faked.

jest.mock('@app/hooks/useEarnings', () => {
  const actual = jest.requireActual('@app/hooks/useEarnings');
  return {
    ...actual,
    useEarningsMonth: jest.fn(),
    useEarningsMonths: jest.fn(),
  };
});
jest.mock('@app/hooks/useTimeWorked');
jest.mock('@app/hooks/useReviewRequests');
jest.mock('@app/services/reviewSeen');
jest.mock('@app/services/statements/statementsApi', () => ({
  fetchStatementMonths: jest.fn(),
  openStatement: jest.fn(),
}));

const mockMonths = fetchStatementMonths as jest.Mock;
const LOAD_FAILED = 'Could not load your statements. Pull to try again.';

describe('Earnings: the pull refreshes the statement months (spec 0050, review fix)', () => {
  const navigation: any = {
    navigate: jest.fn(),
    toggleDrawer: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
  const monthRefetch = jest.fn();
  const coopRefetch = jest.fn();
  const defaults = queryClient.getDefaultOptions();

  // Lets the requests under way answer and the screen draw again.
  const settle = () =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(50);
    });

  const pull = () =>
    act(() => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });

  const renderScreen = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <Earnings navigation={navigation} {...({} as any)} />
      </QueryClientProvider>,
    );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-20T12:00:00.000Z'));
    jest.clearAllMocks();
    queryClient.clear();
    // One try per request, so a failure shows at once instead of after the retries.
    queryClient.setDefaultOptions({
      queries: { ...defaults.queries, retry: false },
    });
    monthRefetch.mockResolvedValue(undefined);
    coopRefetch.mockResolvedValue(undefined);
    // The month itself is not what is tested: the screen has none to show.
    (useEarningsMonths as jest.Mock).mockReturnValue([
      {
        data: undefined,
        isLoading: false,
        isError: true,
        isRefetching: false,
        refetch: monthRefetch,
        dataUpdatedAt: 0,
      },
    ]);
    (useEarningsMonth as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    (useCoopTotals as jest.Mock).mockReturnValue({
      data: null,
      refetch: coopRefetch,
    });
    (useReviewRequests as jest.Mock).mockReturnValue({ data: { pages: [] } });
    (useReviewSeen as jest.Mock).mockReturnValue([]);
  });

  afterEach(() => {
    queryClient.clear();
    queryClient.setDefaultOptions(defaults);
    jest.useRealTimers();
  });

  it('after "Could not load your statements. Pull to try again.", a pull asks again and the months appear', async () => {
    mockMonths.mockRejectedValueOnce(new Error('Network Error'));
    mockMonths.mockResolvedValue(['2026-10', '2026-09']);

    renderScreen();
    await settle();

    expect(screen.getByText(LOAD_FAILED)).toBeTruthy();
    expect(mockMonths).toHaveBeenCalledTimes(1);

    pull();
    await settle();

    expect(mockMonths).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(LOAD_FAILED)).toBeNull();
    expect(screen.getByTestId('statement-2026-10')).toBeTruthy();
    expect(screen.getByTestId('statement-2026-09')).toBeTruthy();
  });

  it('a pull that fails again keeps the same line, and the next pull asks once more', async () => {
    mockMonths.mockRejectedValue(new Error('Network Error'));

    renderScreen();
    await settle();
    pull();
    await settle();

    expect(mockMonths).toHaveBeenCalledTimes(2);
    expect(screen.getByText(LOAD_FAILED)).toBeTruthy();

    pull();
    await settle();

    expect(mockMonths).toHaveBeenCalledTimes(3);
  });

  it('a pull also picks up a month that has become available since the screen opened', async () => {
    mockMonths.mockResolvedValueOnce(['2026-09']);
    mockMonths.mockResolvedValue(['2026-10', '2026-09']);

    renderScreen();
    await settle();

    expect(screen.queryByTestId('statement-2026-10')).toBeNull();

    pull();
    await settle();

    expect(screen.getByTestId('statement-2026-10')).toBeTruthy();
  });

  it("the pull asks for the query keyed ['statementMonths'], along with the month and the co-op card", async () => {
    mockMonths.mockResolvedValue(['2026-10']);
    const refetchQueries = jest.spyOn(queryClient, 'refetchQueries');

    renderScreen();
    await settle();
    pull();
    await settle();

    expect(refetchQueries).toHaveBeenCalledWith({
      queryKey: ['statementMonths'],
    });
    expect(monthRefetch).toHaveBeenCalledTimes(1);
    expect(coopRefetch).toHaveBeenCalledTimes(1);
    refetchQueries.mockRestore();
  });

  it('the spinner stops when the statement months fail to load again', async () => {
    mockMonths.mockRejectedValue(new Error('Network Error'));

    renderScreen();
    await settle();
    pull();

    expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);

    await settle();

    expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
      false,
    );
  });
});
