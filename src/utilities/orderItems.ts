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
  return value.filter(isItem).map(normalised);
}

// Row 159 review: the fields the screens read are made safe too. A quantity sent as text ("2") or missing
// becomes a number (1 when unreadable), so the drinks line never reads "02"; a size that is not text becomes
// '' (no size word); a kind other than the two known ones is dropped (neither).
function normalised(item: OrderItem): OrderItem {
  const quantity = Number(item.quantity);
  return {
    ...item,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    size: typeof item.size === 'string' ? item.size : '',
    kind: item.kind === 'DRINK' || item.kind === 'SIDE' ? item.kind : undefined,
  };
}
