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
});
