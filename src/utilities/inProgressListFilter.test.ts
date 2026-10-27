import {
  filterInProgressOrdersForDisplay,
  hideInProgressOrderAfterDelivery,
} from './inProgressListFilter';
import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';

describe('filterInProgressOrdersForDisplay (decision 65.10)', () => {
  it('returns empty array when input is undefined or empty', () => {
    expect(filterInProgressOrdersForDisplay(undefined)).toEqual([]);
    expect(filterInProgressOrdersForDisplay([])).toEqual([]);
  });

  it('keeps only DISPATCHED and PICKED_UP orders from DISPATCHED, PICKED_UP, DROPPED_OFF, and CANCELED', () => {
    const orders: Partial<Order>[] = [
      { id: 'order-dispatched', status: OrderStatus.dispatched },
      { id: 'order-picked-up', status: OrderStatus.picked_up },
      { id: 'order-dropped-off', status: OrderStatus.dropped_off },
      { id: 'order-canceled', status: OrderStatus.canceled },
    ];

    const result = filterInProgressOrdersForDisplay(orders as Order[]);
    expect(result.map(o => o.id)).toEqual([
      'order-dispatched',
      'order-picked-up',
    ]);
  });

  it('drops an order whose id is in the hidden after delivery set whatever its status', () => {
    hideInProgressOrderAfterDelivery('order-hidden');

    const orders: Partial<Order>[] = [
      { id: 'order-hidden', status: OrderStatus.picked_up },
      { id: 'order-visible', status: OrderStatus.dispatched },
    ];

    const result = filterInProgressOrdersForDisplay(orders as Order[]);
    expect(result.map(o => o.id)).toEqual(['order-visible']);
  });

  it('drops hidden order even if its status is DISPATCHED', () => {
    hideInProgressOrderAfterDelivery('order-hidden-dispatched');

    const orders: Partial<Order>[] = [
      { id: 'order-hidden-dispatched', status: OrderStatus.dispatched },
      { id: 'order-visible-pickup', status: OrderStatus.picked_up },
    ];

    const result = filterInProgressOrdersForDisplay(orders as Order[]);
    expect(result.map(o => o.id)).toEqual(['order-visible-pickup']);
  });
});
