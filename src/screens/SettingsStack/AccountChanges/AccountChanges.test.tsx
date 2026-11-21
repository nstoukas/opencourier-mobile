import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@app/localization/i18n';
import {
  AccountChange,
  fetchAccountChanges,
} from '@app/services/account/accountApi';
import { AccountChanges, accountChangeLine } from './AccountChanges';

jest.mock('@app/services/account/accountApi', () => ({
  fetchAccountChanges: jest.fn(),
}));

const mockFetch = fetchAccountChanges as jest.Mock;
const t = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, options) as string;

const change = (overrides: Partial<AccountChange>): AccountChange => ({
  id: 'change-1',
  kind: 'FIELD_EDITED',
  field: null,
  oldValue: null,
  newValue: null,
  reason: null,
  by: 'the co-op',
  createdAt: '2026-11-21T10:00:00.000Z',
  ...overrides,
});

// Spec 0051 (AC-7): Settings, "Changes by the co-op": the rider's own account record. What changed,
// when, and by whom as "the co-op" (or "you"), never an admin's name.
describe('AccountChanges (spec 0051, AC-7)', () => {
  describe('accountChangeLine: one change in words', () => {
    it('a deactivation by the co-op', () => {
      expect(accountChangeLine(change({ kind: 'DEACTIVATED' }), t)).toBe(
        'Your account was deactivated by the co-op',
      );
    });

    it('a reactivation by the co-op', () => {
      expect(accountChangeLine(change({ kind: 'REACTIVATED' }), t)).toBe(
        'Your account was reactivated by the co-op',
      );
    });

    it('a password set by the co-op', () => {
      expect(accountChangeLine(change({ kind: 'PASSWORD_CHANGED' }), t)).toBe(
        'Your password was changed by the co-op',
      );
    });

    it("the rider's own password change is by you", () => {
      expect(
        accountChangeLine(change({ kind: 'PASSWORD_CHANGED', by: 'you' }), t),
      ).toBe('Your password was changed by you');
    });

    it.each([
      ['firstName', 'First name'],
      ['lastName', 'Last name'],
      ['phoneNumber', 'Phone'],
      ['email', 'Login email'],
      ['emergencyContactName', 'Emergency contact name'],
      ['emergencyContactPhone', 'Emergency contact phone'],
      ['deliverySetting', 'Offers'],
    ])(
      'an edit of %s names the field as "%s", with the old and the new value',
      (field, words) => {
        expect(
          accountChangeLine(
            change({
              kind: 'FIELD_EDITED',
              field,
              oldValue: 'before',
              newValue: 'after',
            }),
            t,
          ),
        ).toBe(`${words} changed by the co-op: before → after`);
      },
    );

    it('the phone and the email are shown in full', () => {
      expect(
        accountChangeLine(
          change({
            field: 'phoneNumber',
            oldValue: '+306900000000',
            newValue: '+306911111111',
          }),
          t,
        ),
      ).toBe('Phone changed by the co-op: +306900000000 → +306911111111');
      expect(
        accountChangeLine(
          change({
            field: 'email',
            oldValue: 'old@coop.gr',
            newValue: 'new@coop.gr',
          }),
          t,
        ),
      ).toBe('Login email changed by the co-op: old@coop.gr → new@coop.gr');
    });

    it('an empty old or new value reads "empty", never "null"', () => {
      expect(
        accountChangeLine(
          change({
            field: 'emergencyContactName',
            oldValue: null,
            newValue: 'Maria',
          }),
          t,
        ),
      ).toBe('Emergency contact name changed by the co-op: empty → Maria');
      expect(
        accountChangeLine(
          change({
            field: 'emergencyContactPhone',
            oldValue: '+306922222222',
            newValue: null,
          }),
          t,
        ),
      ).toBe(
        'Emergency contact phone changed by the co-op: +306922222222 → empty',
      );
    });

    it('a field the app has no words for is shown as sent', () => {
      expect(
        accountChangeLine(
          change({ field: 'vehiclePlate', oldValue: 'A', newValue: 'B' }),
          t,
        ),
      ).toBe('vehiclePlate changed by the co-op: A → B');
    });

    it('whatever the kind, the actor is only ever "the co-op" or "you"', () => {
      for (const kind of [
        'DEACTIVATED',
        'REACTIVATED',
        'PASSWORD_CHANGED',
        'FIELD_EDITED',
      ]) {
        // A server that sent anything else for `by` (an admin's email, say) still reads "the co-op".
        const line = accountChangeLine(
          change({
            kind,
            field: 'firstName',
            by: 'anna.admin@coop.gr' as AccountChange['by'],
          }),
          t,
        );
        expect(line).toContain('by the co-op');
        expect(line).not.toContain('anna.admin@coop.gr');
      }
    });
  });

  describe('the screen', () => {
    let queryClient: QueryClient;
    const navigation: any = { goBack: jest.fn() };

    const renderScreen = () =>
      render(
        <QueryClientProvider client={queryClient}>
          <AccountChanges navigation={navigation} route={{} as any} />
        </QueryClientProvider>,
      );

    beforeEach(() => {
      jest.clearAllMocks();
      queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
    });

    afterEach(() => {
      queryClient.clear();
    });

    it('is titled "Changes by the co-op"', async () => {
      mockFetch.mockResolvedValue([]);

      renderScreen();

      expect(screen.getByText('Changes by the co-op')).toBeTruthy();
      await screen.findByText('Nothing has changed on your account yet.');
    });

    it('lists each change in the order the server gave (newest first), with its reason and when', async () => {
      mockFetch.mockResolvedValue([
        change({
          id: 'c3',
          kind: 'REACTIVATED',
          reason: 'Came back',
          createdAt: '2026-11-21T10:00:00.000Z',
        }),
        change({
          id: 'c2',
          kind: 'DEACTIVATED',
          reason: 'Left the co-op',
          createdAt: '2026-11-20T18:30:00.000Z',
        }),
        change({
          id: 'c1',
          kind: 'PASSWORD_CHANGED',
          by: 'you',
          createdAt: '2026-11-19T08:00:00.000Z',
        }),
      ]);

      renderScreen();

      await screen.findByTestId('account-change-c3');
      const lines = screen
        .getAllByTestId(/^account-change-/)
        .map(row => row.props.testID);
      expect(lines).toEqual([
        'account-change-c3',
        'account-change-c2',
        'account-change-c1',
      ]);
      expect(
        screen.getByText('Your account was reactivated by the co-op'),
      ).toBeTruthy();
      expect(
        screen.getByText('Your account was deactivated by the co-op'),
      ).toBeTruthy();
      expect(screen.getByText('Your password was changed by you')).toBeTruthy();
      expect(screen.getByText('Reason: Came back')).toBeTruthy();
      expect(screen.getByText('Reason: Left the co-op')).toBeTruthy();
      // The co-op's clock (Athens): 18:30 UTC on 20 November is 20:30 there.
      expect(screen.getByText(/2026-11-20\s+20:30/)).toBeTruthy();
    });

    it('a change with no reason shows no "Reason:" line', async () => {
      mockFetch.mockResolvedValue([
        change({ id: 'c1', kind: 'PASSWORD_CHANGED' }),
      ]);

      renderScreen();

      await screen.findByTestId('account-change-c1');
      expect(screen.queryByText(/^Reason:/)).toBeNull();
    });

    it('says "Nothing has changed on your account yet." for a rider with none', async () => {
      mockFetch.mockResolvedValue([]);

      renderScreen();

      expect(
        await screen.findByText('Nothing has changed on your account yet.'),
      ).toBeTruthy();
    });

    it('says so in words when the changes cannot be loaded, not that there are none', async () => {
      mockFetch.mockRejectedValue(new Error('Network Error'));

      renderScreen();

      expect(
        await screen.findByText(
          'Could not load the changes. Pull to try again.',
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText('Nothing has changed on your account yet.'),
      ).toBeNull();
    });

    it('shows no count of changes or deactivations (value 5)', async () => {
      mockFetch.mockResolvedValue([
        change({ id: 'c3', kind: 'DEACTIVATED', reason: 'Away' }),
        change({ id: 'c2', kind: 'REACTIVATED' }),
        change({ id: 'c1', kind: 'DEACTIVATED', reason: 'Left' }),
      ]);

      renderScreen();

      await screen.findByTestId('account-change-c3');
      const texts = screen
        .UNSAFE_getAllByType(require('react-native').Text)
        .map(node => [node.props.children].flat(Infinity).join(''));
      for (const text of texts) {
        expect(text).not.toMatch(/\b\d+\s+(changes?|deactivations?|times?)\b/i);
        expect(text).not.toMatch(/total/i);
      }
    });

    it('is read on each visit and never kept on the phone: asked again when the screen opens again', async () => {
      mockFetch.mockResolvedValue([]);

      const first = renderScreen();
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
      first.unmount();
      renderScreen();

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    });
  });
});
