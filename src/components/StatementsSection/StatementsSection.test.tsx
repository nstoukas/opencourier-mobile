import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@app/localization/i18n';
import {
  fetchStatementMonths,
  openStatement,
} from '@app/services/statements/statementsApi';
import { StatementsSection } from './StatementsSection';

// Spec 0050 (row 76; AC-6, AC-8): Statements on the Earnings screen. The months the server offers, each
// with PDF and CSV, and a line saying what a statement holds and that it is not an invoice.

jest.mock('@app/services/statements/statementsApi', () => ({
  fetchStatementMonths: jest.fn(),
  openStatement: jest.fn(),
}));

const mockMonths = fetchStatementMonths as jest.Mock;
const mockOpen = openStatement as jest.Mock;

const NOTE =
  'Each complete month as a PDF to read or a CSV to calculate with: every job with its pay parts, the totals and your hours. Your record of work, not an invoice.';

// A promise the test settles by hand, to hold a download half way.
const pending = () => {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

describe('StatementsSection (spec 0050, AC-8)', () => {
  let queryClient: QueryClient;

  const renderSection = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <StatementsSection />
      </QueryClientProvider>,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    mockMonths.mockResolvedValue(['2026-10', '2026-09']);
    mockOpen.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    // Taken down first, so putting the language back updates nothing that is still on screen.
    cleanup();
    queryClient.clear();
    if (i18n.language !== 'en') {
      await i18n.changeLanguage('en');
    }
  });

  it('is titled "Statements" and says what a statement holds and that it is not an invoice', async () => {
    renderSection();

    expect(screen.getByText('Statements')).toBeTruthy();
    expect(screen.getByText(NOTE)).toBeTruthy();
    expect(NOTE).toMatch(/not an invoice/);
    await screen.findByTestId('statement-2026-10');
  });

  it('lists every month the server offers, in its order, each with a PDF and a CSV button', async () => {
    renderSection();

    await screen.findByTestId('statement-2026-10');
    const rows = screen.getAllByTestId(/^statement-\d{4}-\d{2}$/);
    expect(rows.map(row => row.props.testID)).toEqual([
      'statement-2026-10',
      'statement-2026-09',
    ]);
    expect(screen.getByText('2026-10')).toBeTruthy();
    expect(screen.getByText('2026-09')).toBeTruthy();
    for (const month of ['2026-10', '2026-09']) {
      expect(screen.getByTestId(`statement-${month}-pdf`)).toBeTruthy();
      expect(screen.getByTestId(`statement-${month}-csv`)).toBeTruthy();
    }
    expect(screen.getAllByText('PDF')).toHaveLength(2);
    expect(screen.getAllByText('CSV')).toHaveLength(2);
  });

  it('each button is named for a screen reader: the format and the month', async () => {
    renderSection();

    await screen.findByTestId('statement-2026-10');
    expect(screen.getByLabelText('PDF statement for 2026-10')).toBeTruthy();
    expect(screen.getByLabelText('CSV statement for 2026-09')).toBeTruthy();
  });

  it('offers only what the server sent: the app works out no month itself', async () => {
    mockMonths.mockResolvedValue(['2026-07']);

    renderSection();

    await screen.findByTestId('statement-2026-07');
    expect(screen.getAllByTestId(/^statement-\d{4}-\d{2}$/)).toHaveLength(1);
  });

  it('a rider with no complete month yet reads when the first statement comes', async () => {
    mockMonths.mockResolvedValue([]);

    renderSection();

    expect(
      await screen.findByText(
        'Your first statement comes after your first full month.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('PDF')).toBeNull();
  });

  it('while the months are loading it does not claim there are none', () => {
    mockMonths.mockReturnValue(new Promise(() => undefined));

    renderSection();

    expect(
      screen.queryByText(
        'Your first statement comes after your first full month.',
      ),
    ).toBeNull();
    expect(screen.getByText('Statements')).toBeTruthy();
  });

  it('says so when the months cannot be loaded, not that there are none', async () => {
    mockMonths.mockRejectedValue(new Error('Network Error'));

    renderSection();

    expect(
      await screen.findByText(
        'Could not load your statements. Pull to try again.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Your first statement comes after your first full month.',
      ),
    ).toBeNull();
  });

  it('tapping PDF opens that month as a PDF; tapping CSV opens it as a CSV', async () => {
    renderSection();

    fireEvent.press(await screen.findByTestId('statement-2026-09-pdf'));
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
    expect(mockOpen).toHaveBeenLastCalledWith('2026-09', 'pdf', 'en');

    await waitFor(() =>
      expect(
        screen.getByTestId('statement-2026-10-csv').props.accessibilityState
          ?.disabled,
      ).toBeFalsy(),
    );
    fireEvent.press(screen.getByTestId('statement-2026-10-csv'));
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(2));
    expect(mockOpen).toHaveBeenLastCalledWith('2026-10', 'csv', 'en');
  });

  it('AC-6: an app in Greek asks for the Greek statement', async () => {
    await act(async () => {
      await i18n.changeLanguage('el');
    });
    renderSection();

    fireEvent.press(await screen.findByTestId('statement-2026-10-pdf'));

    await waitFor(() =>
      expect(mockOpen).toHaveBeenCalledWith('2026-10', 'pdf', 'el'),
    );
  });

  it('AC-6: a Greek locale with a region (el-GR) still asks for Greek', async () => {
    await act(async () => {
      await i18n.changeLanguage('el-GR');
    });
    renderSection();

    fireEvent.press(await screen.findByTestId('statement-2026-10-csv'));

    await waitFor(() =>
      expect(mockOpen).toHaveBeenCalledWith('2026-10', 'csv', 'el'),
    );
  });

  it('AC-6: an app in English asks for the English statement', async () => {
    renderSection();

    fireEvent.press(await screen.findByTestId('statement-2026-10-pdf'));

    await waitFor(() =>
      expect(mockOpen).toHaveBeenCalledWith('2026-10', 'pdf', 'en'),
    );
  });

  it('while one download runs its button shows "…" and no other can be started', async () => {
    const download = pending();
    mockOpen.mockReturnValue(download.promise);
    renderSection();

    fireEvent.press(await screen.findByTestId('statement-2026-10-pdf'));

    await waitFor(() => expect(screen.getByText('…')).toBeTruthy());
    // Only the tapped button is busy: one PDF label left (September's), both CSV labels still there.
    expect(screen.getAllByText('PDF')).toHaveLength(1);
    expect(screen.getAllByText('CSV')).toHaveLength(2);
    fireEvent.press(screen.getByTestId('statement-2026-10-csv'));
    fireEvent.press(screen.getByTestId('statement-2026-09-pdf'));
    fireEvent.press(screen.getByTestId('statement-2026-10-pdf'));
    expect(mockOpen).toHaveBeenCalledTimes(1);

    await act(async () => {
      download.resolve();
      await download.promise;
    });

    await waitFor(() => expect(screen.queryByText('…')).toBeNull());
    expect(screen.getAllByText('PDF')).toHaveLength(2);
    fireEvent.press(screen.getByTestId('statement-2026-09-csv'));
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(2));
  });

  it('a download that fails says so, and the buttons work again', async () => {
    mockOpen.mockRejectedValueOnce(
      new Error('Statement download answered 500'),
    );
    renderSection();

    expect(
      screen.queryByText('The statement could not be opened. Try again.'),
    ).toBeNull();
    fireEvent.press(await screen.findByTestId('statement-2026-10-pdf'));

    expect(
      await screen.findByText('The statement could not be opened. Try again.'),
    ).toBeTruthy();
    expect(screen.queryByText('…')).toBeNull();
    // The months are still listed.
    expect(screen.getByTestId('statement-2026-10')).toBeTruthy();

    // A second try that works takes the failure line away.
    fireEvent.press(screen.getByTestId('statement-2026-10-pdf'));
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByText('The statement could not be opened. Try again.'),
      ).toBeNull(),
    );
  });

  it('a download that works shows no failure line', async () => {
    renderSection();

    fireEvent.press(await screen.findByTestId('statement-2026-10-csv'));

    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('…')).toBeNull());
    expect(
      screen.queryByText('The statement could not be opened. Try again.'),
    ).toBeNull();
  });

  it('is read on each visit and never kept: asked again when the section opens again', async () => {
    const first = renderSection();
    await screen.findByTestId('statement-2026-10');
    first.unmount();

    renderSection();
    await screen.findByTestId('statement-2026-10');

    expect(mockMonths).toHaveBeenCalledTimes(2);
  });

  // Value 5, cross check 16.
  it('shows no figure at all: no money, no count, no comparison with other riders (value 5)', async () => {
    renderSection();

    await screen.findByTestId('statement-2026-10');
    const text = JSON.stringify(screen.toJSON());
    expect(text).not.toMatch(/€|average|other riders|rank/i);
  });
});
