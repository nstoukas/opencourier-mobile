import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { RemovalNotices } from './RemovalNotices';
import {
  clearRemovalNotices,
  showRemovalDecision,
} from '@app/services/removalNotice/removalNotice';
import { RemovalDecision } from '@app/utilities/removalRequest';
import i18n from '@app/localization/i18n';

describe('RemovalNotices component (spec 0035, AC-11, decision 24.22)', () => {
  beforeEach(() => {
    act(() => {
      clearRemovalNotices();
    });
  });

  afterEach(() => {
    act(() => {
      clearRemovalNotices();
    });
  });

  it('renders nothing when there are no notices', () => {
    const { toJSON } = render(<RemovalNotices />);
    expect(toJSON()).toBeNull();
  });

  it('renders an approved notice naming amount and dismisses on tap', async () => {
    const approvedDecision: RemovalDecision = {
      deliveryId: 'del-card-1',
      outcome: 'APPROVED',
      decisionNote: null,
      paid: true,
      payAmount: 380,
      currencyCode: 'EUR',
    };

    await act(async () => {
      await showRemovalDecision(approvedDecision);
    });

    render(<RemovalNotices />);

    expect(
      screen.getByText(i18n.t('translations:removal_notice_title_approved')),
    ).toBeTruthy();
    expect(screen.getByText(/€3\.80/)).toBeTruthy();

    const card = screen.getByTestId('removal-notice');
    expect(card).toBeTruthy();

    // Tap to dismiss
    act(() => {
      fireEvent.press(card);
    });

    expect(screen.queryByTestId('removal-notice')).toBeNull();
  });

  it('renders a declined notice with plain text even when note contains < (Behaviour 10)', async () => {
    const declinedDecision: RemovalDecision = {
      deliveryId: 'del-card-2',
      outcome: 'DECLINED',
      decisionNote: 'Food needs < 5 minutes',
      paid: false,
      payAmount: null,
      currencyCode: 'EUR',
    };

    await act(async () => {
      await showRemovalDecision(declinedDecision);
    });

    render(<RemovalNotices />);

    expect(
      screen.getByText(i18n.t('translations:removal_notice_title_declined')),
    ).toBeTruthy();

    // On the card, text is plain react-native Text, so it contains literal '<' and NOT '&lt;'
    expect(screen.getByText('Food needs < 5 minutes')).toBeTruthy();
    expect(screen.queryByText(/&lt;/)).toBeNull();
  });
});
