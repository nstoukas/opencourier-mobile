import React from 'react';
import { render } from '@testing-library/react-native';
import { HistoryCell } from './HistoryCell';
import { StatusBadge } from '@app/components/StatusBadge/StatusBadge';
import { Order } from '@app/types/types';
import '@app/localization/i18n';

describe('AC-8: HistoryCell renders StatusBadge for order.status', () => {
  const baseOrder: Partial<Order> = {
    id: 'test-order-1',
    createdAt: '2026-10-27T10:00:00.000Z',
    pickupReadyAt: '2026-10-27T10:15:00.000Z',
    dropoffReadyAt: '2026-10-27T10:45:00.000Z',
    totalCompensation: 650,
    currencyCode: 'EUR',
    orderItems: [],
    customerNotes: [],
  };

  it('renders StatusBadge with status="DROPPED_OFF" showing "Delivered"', () => {
    const order = { ...baseOrder, status: 'DROPPED_OFF' } as Order;
    const { UNSAFE_getByType, getByText } = render(
      <HistoryCell order={order} onPress={() => {}} />,
    );

    const badge = UNSAFE_getByType(StatusBadge);
    expect(badge.props.status).toBe('DROPPED_OFF');
    expect(getByText('Delivered')).toBeDefined();
  });

  it('renders StatusBadge with status="CANCELED" showing "Canceled"', () => {
    const order = { ...baseOrder, status: 'CANCELED' } as Order;
    const { UNSAFE_getByType, getByText } = render(
      <HistoryCell order={order} onPress={() => {}} />,
    );

    const badge = UNSAFE_getByType(StatusBadge);
    expect(badge.props.status).toBe('CANCELED');
    expect(getByText('Canceled')).toBeDefined();
  });

  describe('createdAt timezone handling (row 66 review fix)', () => {
    const originalTZ = process.env.TZ;

    beforeAll(() => {
      process.env.TZ = 'Europe/Athens';
    });

    afterAll(() => {
      process.env.TZ = originalTZ;
    });

    it('shows the date of the UTC instant in Europe/Athens time zone (28 Oct 2026 instead of 27 Oct 2026)', () => {
      const order = {
        ...baseOrder,
        createdAt: '2026-10-27T22:30:00.000Z',
        status: 'DROPPED_OFF',
      } as Order;

      const { getByText, queryByText } = render(
        <HistoryCell order={order} onPress={() => {}} />,
      );

      // In Europe/Athens (UTC+2 in late October), 22:30 UTC is 00:30 on 28 Oct 2026.
      // The old format 'YYYY-MM-DDThh:mm:ss[Z]' parsed it as local time 27 Oct 2026.
      expect(getByText(/28 Oct 2026/)).toBeDefined();
      expect(queryByText(/27 Oct 2026/)).toBeNull();
    });
  });
});
