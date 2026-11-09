import { DeliveryIssueReason } from './enums';

describe('DeliveryIssueReason enum wire spellings (review finding, Major)', () => {
  it('Object.values(DeliveryIssueReason) equals exactly the backend wire strings', () => {
    // Backend EnumDeliveryIssueReason: WRONG_ADDRESS, NO_SIGNAL, ORDER_HANDED, FOOD_NOT_READY, OTHER
    expect(Object.values(DeliveryIssueReason)).toEqual([
      'WRONG_ADDRESS',
      'NO_SIGNAL',
      'ORDER_HANDED',
      'FOOD_NOT_READY',
      'OTHER',
    ]);
  });

  it('pins each enum member to its literal wire string', () => {
    expect(DeliveryIssueReason.WrongAddress).toBe('WRONG_ADDRESS');
    expect(DeliveryIssueReason.NoSignal).toBe('NO_SIGNAL');
    expect(DeliveryIssueReason.OrderHanded).toBe('ORDER_HANDED');
    expect(DeliveryIssueReason.FoodNotReady).toBe('FOOD_NOT_READY');
    expect(DeliveryIssueReason.Other).toBe('OTHER');
  });
});
