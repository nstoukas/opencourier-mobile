import { OrderItem } from '@app/types/types';

// Row 159: an order's items are free JSON on the server (a restaurant system can send anything), so
// the type cannot promise OrderItem[]. This is the one way the screens read them: anything that is not a
// list gives no items, and a list keeps only the entries with a name, so the job card's line and sheet and
// the Report a product picker never meet a shape they cannot draw.

// `value is X` is a type predicate: inside `if (isItem(v))`, TypeScript treats `v` as an OrderItem.
function isItem(value: unknown): value is OrderItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const name = (value as { name?: unknown }).name;
  return typeof name === 'string' && name.trim().length > 0;
}

export function orderItemsOf(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isItem);
}
